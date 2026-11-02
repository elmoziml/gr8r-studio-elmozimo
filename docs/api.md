# Gr8r Studio API

The app has two data paths:

```
browser demo:  UI / store -> in-browser api -> file repository (seed + localStorage)
self-hosted:   UI -> /api -> Fastify server -> PostgreSQL
```

The browser demo remains available when the Fastify server is not running. The self-hosted path
adds a first-run setup wizard, real authentication, a server-side PostgreSQL bootstrap, and a
revisioned workspace sync that persists UI edits to PostgreSQL.

## Running self-hosted

```bash
npm run dev          # Vite + Fastify together, open http://localhost:5173
npm run dev:web      # Vite only, proxies /api to :4000
npm run dev:server   # Fastify only on :4000 (loads .env)
npm start            # production server after npm run build
```

If the API server is unreachable, the UI now shows an "API server is not running" screen with a
retry button instead of silently opening demo data. Use `http://localhost:5173/?demo=1` (or
`VITE_DEMO=1`) to open the local demo explicitly.

Database credentials are read **only** from the server environment. The setup wizard never asks
for or stores a connection string.

```bash
# .env (gitignored) or the server environment
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

Open the app. On the first run the setup wizard checks:

1. Is `DATABASE_URL` configured and reachable?
2. Are the tables and migrations up to date?
3. Create the owner account and workspace.

`DATA_DIR/config.json` stores only non-database settings such as the generated session secret.
Set `SETUP_TOKEN` before exposing the server publicly; the wizard then requires that token. Setup
endpoints lock permanently after completion.

## Authentication

Registration is open after setup. Passwords are hashed with Argon2id and sessions use an opaque
HTTP-only cookie (`gr8r_session`) whose hash is stored in the `sessions` table.

| Method | Path                            | Description                                        |
| ------ | ------------------------------- | -------------------------------------------------- |
| POST   | `/api/auth/signup`              | Create a user + owned workspace, then log in       |
| POST   | `/api/auth/login`               | Email/password login                               |
| POST   | `/api/auth/logout`              | Revoke the current session                         |
| POST   | `/api/auth/password`            | Change password and revoke other sessions          |
| GET    | `/api/auth/me`                  | Current user, member, and active workspace         |
| GET    | `/api/auth/sessions`            | Active sessions for the current user               |
| DELETE | `/api/auth/sessions`            | Revoke all other sessions                          |
| DELETE | `/api/auth/sessions/{id}`       | Revoke one session                                 |
| GET    | `/api/bootstrap`                | Authenticated workspace snapshot for the UI        |
| PUT    | `/api/workspace`                | Persist the workspace document (revision checked)  |
| POST   | `/api/workspaces/{id}/activate` | Switch the active workspace                        |
| DELETE | `/api/workspaces/{id}`          | Delete a workspace (owner/admin, not the last one) |

Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS. Set `TRUST_PROXY=1` when running
behind a reverse proxy so secure-cookie detection works. Login is rate-limited in memory.

Email verification, password reset by email, and social login are not configured yet.

## Authorization and RLS

`PUT /api/workspace` enforces workspace roles before writing:

- **Owner:** workspace settings, plan, members, roles, and all content.
- **Admin:** workspace settings and members, but cannot assign or demote `Owner`.
- **Member:** content in accessible projects only; cannot change workspace settings, members, teams,
  project access, project members, or permissions; cannot edit/delete other members' comments or
  files.
- **Guest:** cannot modify the workspace.

Private projects are filtered from bootstrap and RLS for non-members. New comments, files, and
activity entries are attributed to the authenticated member, not a client-supplied actor.

Database RLS backs the server checks. The server switches to the non-bypass `gr8r_app` role inside
workspace transactions and sets `app.user_id`; policies use `app_is_member`, `app_can_project`,
`app_can_task`, and `app_can_comment`. The migration files are `004_rls.sql` and
`005_rls_private_projects.sql`.

## Database setup without the wizard

```bash
# create the schema once
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql

# run migrations (baseline + platform tables)
npm run db:migrate

# import the demo document (aborts if data already exists)
npm run db:seed

# replace existing data with a fresh seed
npm run db:seed:reset
```

`scripts/seed-db.mjs` maps seed ids (`p1`, `m1`, `t3`) to UUIDs, converts display strings to typed
columns (`size_bytes`, `amount_cents`, timestamps), and inserts rows in foreign-key order.

### Server environment

| Variable         | Default   | Meaning                                       |
| ---------------- | --------- | --------------------------------------------- |
| `DATABASE_URL`   | none      | Environment-only PostgreSQL connection string |
| `DATA_DIR`       | `.data`   | Config and uploads volume                     |
| `PORT`           | `4000`    | HTTP port                                     |
| `HOST`           | `0.0.0.0` | Bind address                                  |
| `SETUP_TOKEN`    | none      | Required header token for setup mutations     |
| `SESSION_SECRET` | generated | Cookie/session secret                         |
| `TRUST_PROXY`    | `0`       | Set to `1` behind a reverse proxy             |
| `LOG_LEVEL`      | `info`    | Fastify log level                             |

## Files

| File                                    | Responsibility                                         |
| --------------------------------------- | ------------------------------------------------------ |
| `server/index.js`                       | Fastify app, static build, health and error handling   |
| `server/config.js`                      | `DATA_DIR`, env DB config, session secret              |
| `server/db/pool.js`                     | Lazy PostgreSQL pool and connection test               |
| `server/db/migrate.js`                  | Migration runner and baseline detection                |
| `server/db/demo-data.js`                | Demo data importer for the setup wizard                |
| `server/routes/setup.js`                | Setup status, connection, migrate, install endpoints   |
| `server/routes/auth.js`                 | Login, signup, logout, current user, sessions          |
| `server/routes/bootstrap.js`            | Authenticated workspace snapshot and serializers       |
| `server/routes/workspace.js`            | Revisioned workspace persistence and cascades          |
| `server/auth/session.js`                | Cookie sessions, token hashing, auth context           |
| `server/db/create-workspace.js`         | Shared owner/workspace creation for setup and signup   |
| `database/migrations/`                  | SQL migrations (`001_initial`, `002_platform`)         |
| `src/pages/setup.js`                    | First-run setup wizard UI                              |
| `src/actions/auth.js`                   | Real login/signup/logout UI actions                    |
| `src/api/backend.js`                    | Fetch client for the Fastify `/api` endpoints          |
| `src/api/config.js`                     | Demo mode (`file` / `database`), latency, storage keys |
| `src/api/client.js`                     | In-browser `request()` and per-resource helpers        |
| `src/api/routes.js`                     | In-browser route handlers for demo mode                |
| `src/api/repository/file-repository.js` | File/localStorage demo adapter                         |
| `src/api/repository/db-repository.js`   | Future in-process database adapter                     |
| `database/schema.sql`                   | PostgreSQL baseline schema (24 tables, 11 enums)       |
| `scripts/seed-db.mjs`                   | Standalone seed importer                               |

## Configuration

| Variable            | Default | Meaning                                                                      |
| ------------------- | ------- | ---------------------------------------------------------------------------- |
| `VITE_API_MODE`     | `file`  | `file` or `database`                                                         |
| `VITE_API_BASE_URL` | empty   | When set, requests go over HTTP to this server instead of running in-process |
| `VITE_API_LATENCY`  | `0`     | Simulated request delay in milliseconds (file mode)                          |

## Response shape

Successful requests resolve to `{ data, meta }`. Failures throw `ApiError` with a numeric
`status`.

```js
import { api } from './src/api/index.js';

const tasks = await api.tasks.list({ project: 'p1', status: 'todo' });
const task = await api.tasks.get('t3');
const created = await api.tasks.create({ project: 'p1', title: 'New task' });
const updated = await api.tasks.update(created.id, { status: 'done' });
await api.tasks.remove(created.id);

const document = await api.bootstrap();
await api.saveDocument({ data: document.data, prefs: document.prefs, views: document.views, collapsed: document.collapsed });
```

## Endpoints

### Documents and settings

| Method | Path             | Description                                          |
| ------ | ---------------- | ---------------------------------------------------- |
| GET    | `/health`        | Status and active repository mode                    |
| GET    | `/bootstrap`     | Full document: `data`, `prefs`, `views`, `collapsed` |
| PUT    | `/document`      | Persist the full document                            |
| POST   | `/reset`         | Restore the seed document (`keepPrefs` optional)     |
| GET    | `/vocabulary`    | Statuses, priorities, labels, project statuses       |
| GET    | `/workspace`     | Active workspace metadata                            |
| PATCH  | `/workspace`     | Update workspace metadata                            |
| GET    | `/me`            | Current member                                       |
| GET    | `/preferences`   | User preferences                                     |
| PATCH  | `/preferences`   | Update preferences                                   |
| GET    | `/project-order` | Ordered project ids                                  |
| PUT    | `/project-order` | Replace the order (`{ order: [...] }`)               |

### Collections

`workspaces`, `teams`, `members`, `projects`, `tasks`, `comments`, `activity`, `notifications`,
`files`, `events`, `saved-views`, `sessions`, `invoices`.

| Method | Path                 | Description                          |
| ------ | -------------------- | ------------------------------------ |
| GET    | `/{collection}`      | List with filters and pagination     |
| GET    | `/{collection}/{id}` | Read one item                        |
| POST   | `/{collection}`      | Create an item (server-generated id) |
| PATCH  | `/{collection}/{id}` | Merge fields into an item            |
| PUT    | `/{collection}/{id}` | Same as PATCH                        |
| DELETE | `/{collection}/{id}` | Remove an item                       |

List query parameters:

- Any field name filters by value, e.g. `/tasks?project=p1&status=todo`
- Arrays match membership, e.g. `/tasks?labels=design`
- `q` searches the whole item text
- `sort` and `order` (`asc` / `desc`) sort the result
- `offset` and `limit` paginate

### Nested read routes

| Path                        | Description                |
| --------------------------- | -------------------------- |
| `/projects/{id}/tasks`      | Tasks in a project         |
| `/projects/{id}/files`      | Project files              |
| `/projects/{id}/events`     | Project calendar events    |
| `/projects/{id}/milestones` | Project milestones         |
| `/tasks/{id}/comments`      | Comments on a task         |
| `/tasks/{id}/subtasks`      | Subtasks on a task         |
| `/tasks/{id}/files`         | Attachments for a task     |
| `/members/{id}/tasks`       | Tasks assigned to a member |

### Views, search and recents

| Method | Path                      | Description                                       |
| ------ | ------------------------- | ------------------------------------------------- |
| GET    | `/views`                  | All saved view states                             |
| GET    | `/views/{key}`            | One view state                                    |
| PUT    | `/views/{key}`            | Create or replace a view state                    |
| DELETE | `/views/{key}`            | Delete a view state                               |
| GET    | `/search?q=...`           | Search members, projects, tasks, files and events |
| GET    | `/recent-searches`        | Recent search terms                               |
| POST   | `/recent-searches`        | Add a term (`{ term }`, keeps five)               |
| DELETE | `/recent-searches/{term}` | Remove a term                                     |

## Connecting the database later

`src/api/routes.js` has no DOM dependency, so the same handlers can run in two places:

### Option A: in-process adapter

1. Implement `createDatabaseRepository()` in `src/api/repository/db-repository.js` with the same
   contract: `kind`, `loadSync()`, `load()`, `save(document)`, `reset(patch)`.
2. Map the document collections to the tables in `database/schema.sql`. The file adapter's
   document shape is the contract: `data` (workspace, members, projects, tasks, comments,
   activity, notifications, files, events, saved views, sessions, invoices), `prefs`, `views`,
   `collapsed`.
3. Set `VITE_API_MODE=database` and provide the database client to the adapter.
4. Keep routes and UI unchanged. For databases without a synchronous read, return `null` from
   `loadSync()`; `main.js` awaits `hydrate()` before the first render.

### Option B: HTTP server (recommended for credentials)

1. Mount `handle()` from `src/api/routes.js` on a Node/serverless HTTP server, backed by a
   database repository that uses `database/schema.sql`.
2. Return the same `{ data, meta }` envelope and `{ message }` error body.
3. Set `VITE_API_BASE_URL=https://your-api.example.com` in the frontend. `src/api/client.js` then
   sends real `fetch` requests and stops using the in-process file routes.
4. Keep the UI and the `api.*` calls unchanged.

Mutation endpoints are already server-shaped: they generate ids and task keys, apply defaults,
persist through the repository, and return copies rather than live objects.
