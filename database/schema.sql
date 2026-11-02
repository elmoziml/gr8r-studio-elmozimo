-- =============================================================================
-- Gr8r Studio — Database Schema
-- =============================================================================
-- Extracted 1:1 from the application data model (plain SQL, PostgreSQL 15+).
--
-- Sources (frontend, all state lives in one JSON document):
--   src/data/seed.js        -> seed document: ws, workspaces, me, members,
--                              projects, tasks, comments, activity, notifs,
--                              files, events, projOrder, savedViews,
--                              recentSearches, sessions, invoices, tfa,
--                              notifPrefs
--   src/core/constants.js   -> STATUSES, PRIOS, LABELS, PSTAT, PCOLORS,
--                              PICONS, ROLES, TEAMS_SEED
--   src/core/store.js       -> DEFAULT_PREFS, teamsList() (lazy team seed),
--                              localStorage key "gr8r.v2" ({data, prefs,
--                              views, collapsed})
--   src/actions/actions.js  -> fields added at runtime: task.archived/
--                              archivedAt, task.completedAt/prevStatus,
--                              project.archived/archivedAt, project.access,
--                              project.perms, project.seq, plan, subtask
--                              note/assignee/due, notifications
--
-- Mapping decisions (documented inline as comments):
--   * Seed ids are short strings ('p1', 'm1', 't3', …). Here every table uses
--     UUIDs; the migration script must remap seed ids once.
--   * D().me (current member) is derived from the auth session, not stored.
--   * D().ws (active workspace) is stored as user_preferences.active_workspace_id.
--   * D().projOrder (ordered project id array) becomes projects.position.
--   * task.attachments[] duplicates rows of D().files — both become the single
--     `files` table (attachments = files WHERE task_id IS NOT NULL).
--   * Date-only strings ('YYYY-MM-DD': due, start, milestones.date,
--     events.date) become DATE. Epoch-ms fields (created, updated, at,
--     completedAt, archivedAt) become TIMESTAMPTZ.
--   * members.last / projects.last are "minutes ago" counters -> last_seen_at /
--     last_activity_at TIMESTAMPTZ.
--   * files.size is a display string ("4.2 MB") -> size_bytes BIGINT, formatted
--     on the client.
--   * sessions.at is a display string ("Active now", "Sep 12") -> last_seen_at.
--   * invoices.amt is a display string ("$96.00") -> amount_cents INTEGER.
--   * D().plan (Free/Team/Business) lives on workspaces.plan.
--   * D().tfa and D().notifPrefs are per-user settings -> user_preferences.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- None required: gen_random_uuid() is built into PostgreSQL 13+.


-- -----------------------------------------------------------------------------
-- Enumerated vocabularies (mirror src/core/constants.js and seed values)
-- -----------------------------------------------------------------------------
CREATE TYPE task_status    AS ENUM ('backlog', 'todo', 'progress', 'review', 'done');
CREATE TYPE project_status AS ENUM ('planning', 'active', 'risk', 'hold', 'complete');
CREATE TYPE priority       AS ENUM ('urgent', 'high', 'medium', 'low', 'none');
CREATE TYPE member_role    AS ENUM ('Owner', 'Admin', 'Member', 'Guest');
CREATE TYPE member_status  AS ENUM ('active', 'invited', 'deactivated');
CREATE TYPE workspace_plan AS ENUM ('Free', 'Team', 'Business');
CREATE TYPE project_access AS ENUM ('private', 'workspace');
CREATE TYPE perm_level     AS ENUM ('Can view', 'Can comment', 'Can edit', 'Full access');
CREATE TYPE notif_type     AS ENUM ('mention', 'assign', 'comment', 'update');
CREATE TYPE file_type      AS ENUM ('fig', 'pdf', 'zip', 'img', 'sheet', 'doc', 'code', 'other');
CREATE TYPE repeat_rule    AS ENUM ('Daily', 'Weekly', 'Every 2 weeks', 'Monthly');


-- -----------------------------------------------------------------------------
-- users
-- Global identities. In the prototype auth is mocked (src/actions/actions.js
-- doLogin/doSignup only validate locally); in production this row is linked to
-- the auth provider (e.g. Supabase auth.users). Password/verification state
-- lives in the auth provider, not here.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  name       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- workspaces
-- Maps seed `ws` ({name, url, c, brand}) merged with `workspaces[]`
-- ({id, name, c, plan, brand}). D().plan is stored here (settings page reads
-- d.plan with 'Team' as fallback — src/pages/settings.js).
-- -----------------------------------------------------------------------------
CREATE TABLE workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  url        text NOT NULL UNIQUE,
  color      text NOT NULL DEFAULT '#1D1C1A',      -- ws.c (hex)
  plan       workspace_plan NOT NULL DEFAULT 'Free',
  brand      boolean NOT NULL DEFAULT false,        -- ws.brand (brand logo flag)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- teams
-- Seeded lazily on first use from TEAMS_SEED (src/core/constants.js) via
-- teamsList() (src/core/store.js): {id, name, icon, c, desc}. Created/edited
-- through the team modal (src/actions/teams.js). Unique name per workspace.
-- -----------------------------------------------------------------------------
CREATE TABLE teams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  icon         text NOT NULL DEFAULT 'users',      -- Lucide icon name (PICONS)
  color        text NOT NULL DEFAULT '#23918A',    -- hex (PCOLORS value)
  description  text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

-- -----------------------------------------------------------------------------
-- members
-- Workspace members, maps seed `members[]`: {id, name, email, role, team,
-- title, c, status, last, tz}. user_id links the workspace profile to a global
-- account once the invited person signs up (NULL while status = 'invited').
-- `last` ("minutes ago") becomes last_seen_at (computed at migration time).
-- -----------------------------------------------------------------------------
CREATE TABLE members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  name          text NOT NULL,
  email         text NOT NULL,
  role          member_role NOT NULL DEFAULT 'Member',
  team_id       uuid REFERENCES teams(id) ON DELETE SET NULL,
  title         text NOT NULL DEFAULT '',
  avatar_color  text NOT NULL DEFAULT '#6B7280',   -- member.c (hex)
  status        member_status NOT NULL DEFAULT 'active',
  timezone      text,                              -- member.tz (display label)
  last_seen_at  timestamptz,                       -- member.last
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

-- -----------------------------------------------------------------------------
-- projects
-- Maps seed `projects[]`: {id, key, name, icon, color, status, team, lead,
-- due, start, fav, members, desc, milestones, last, private}. Runtime fields
-- (src/actions/actions.js): archived/archivedAt, access, perms, seq.
-- `position` replaces D().projOrder. `seq` backs nextKey() (p.seq || 200).
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key              text NOT NULL,                   -- e.g. 'WEB' (makeKey)
  name             text NOT NULL,
  icon             text NOT NULL DEFAULT 'folder',  -- Lucide icon name (PICONS)
  color            text NOT NULL DEFAULT 'indigo',  -- PCOLORS key
  status           project_status NOT NULL DEFAULT 'planning',
  team_id          uuid REFERENCES teams(id) ON DELETE SET NULL,
  lead_id          uuid REFERENCES members(id) ON DELETE SET NULL,
  due              date,                            -- ISO 'YYYY-MM-DD'
  start            date,                            -- ISO 'YYYY-MM-DD'
  fav              boolean NOT NULL DEFAULT false,
  description      text NOT NULL DEFAULT '',
  private          boolean NOT NULL DEFAULT false,  -- project.private
  access           project_access NOT NULL DEFAULT 'workspace', -- share modal
  archived         boolean NOT NULL DEFAULT false,
  archived_at      timestamptz,
  last_activity_at timestamptz,                     -- project.last
  position         numeric NOT NULL DEFAULT 0,      -- D().projOrder order
  seq              integer NOT NULL DEFAULT 200,    -- nextKey() counter
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

-- -----------------------------------------------------------------------------
-- project_members
-- Maps projects.members[] plus the share modal permission map p.perms
-- {memberId: perm} (src/overlays/modals.js). `position` preserves the array
-- order used by avStack().
-- -----------------------------------------------------------------------------
CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  perm       perm_level NOT NULL DEFAULT 'Can edit',
  position   smallint NOT NULL DEFAULT 0,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, member_id)
);

-- -----------------------------------------------------------------------------
-- milestones
-- Maps projects.milestones[]: {name, date}. Display-only today (no edit UI);
-- `position` preserves array order.
-- -----------------------------------------------------------------------------
CREATE TABLE milestones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL,
  date       date NOT NULL,
  position   smallint NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- labels
-- Fixed vocabulary from LABELS (src/core/constants.js). Ids are the app's
-- short ids ('design', 'frontend', …). Colors are the hex values behind the
-- CSS vars the app stores (var(--violet) etc. — src/styles/tokens.css).
-- -----------------------------------------------------------------------------
CREATE TABLE labels (
  id    text PRIMARY KEY,  -- 'design', 'frontend', 'backend', 'research', 'content', 'bug', 'qa', 'growth'
  name  text NOT NULL,
  color text NOT NULL      -- hex
);

-- -----------------------------------------------------------------------------
-- tasks
-- Maps seed `tasks[]`: {id, key, project, title, status, assignee, priority,
-- due, start, labels, subtasks, attachments, deps, desc, estimate, created,
-- updated, order, fav, recur}. Runtime: completedAt, prevStatus, archived,
-- archivedAt. Key is unique per project ('WEB-103').
-- -----------------------------------------------------------------------------
CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key          text NOT NULL,                      -- 'WEB-103' (nextKey)
  title        text NOT NULL,
  status       task_status NOT NULL DEFAULT 'todo',
  assignee_id  uuid REFERENCES members(id) ON DELETE SET NULL,
  priority     priority NOT NULL DEFAULT 'none',
  due          date,                               -- ISO 'YYYY-MM-DD'
  start        date,                               -- ISO 'YYYY-MM-DD'
  description  text NOT NULL DEFAULT '',           -- task.desc (HTML)
  estimate     text,                               -- '30m','1h','2h','4h','1d','2d','3d','5d','8d'
  "order"      numeric NOT NULL DEFAULT 0,         -- manual/board order (fractional midpoints)
  fav          boolean NOT NULL DEFAULT false,
  repeat       repeat_rule,                        -- task.recur
  archived     boolean NOT NULL DEFAULT false,
  archived_at  timestamptz,
  completed_at timestamptz,                        -- set on status -> done
  prev_status  task_status,                        -- status before done
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

-- -----------------------------------------------------------------------------
-- task_labels
-- Maps tasks.labels[] (string ids). `position` preserves array order.
-- -----------------------------------------------------------------------------
CREATE TABLE task_labels (
  task_id   uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id  text NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  position  smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, label_id)
);

-- -----------------------------------------------------------------------------
-- subtasks
-- Maps tasks.subtasks[]: {id, title, done} plus runtime note/assignee/due set
-- from the subtask detail view (src/actions/subtasks.js). `position` preserves
-- array order.
-- -----------------------------------------------------------------------------
CREATE TABLE subtasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title       text NOT NULL,
  done        boolean NOT NULL DEFAULT false,
  note        text,
  assignee_id uuid REFERENCES members(id) ON DELETE SET NULL,
  due         date,
  position    smallint NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- task_dependencies
-- Maps tasks.deps[] (array of task ids, "Blocked by …"). `position` preserves
-- array order (chips render in array order).
-- -----------------------------------------------------------------------------
CREATE TABLE task_dependencies (
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id   uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  position        smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id)
);

-- -----------------------------------------------------------------------------
-- comments
-- Maps seed `comments[]`: {id, task, by, at, text, re}. `re` (reaction map)
-- moves to comment_reactions.
-- -----------------------------------------------------------------------------
CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE, -- by
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()                      -- at
);

-- -----------------------------------------------------------------------------
-- comment_reactions
-- Maps comments.re: {emoji: [memberId, …]}.
-- -----------------------------------------------------------------------------
CREATE TABLE comment_reactions (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, member_id, emoji)
);

-- -----------------------------------------------------------------------------
-- activity
-- Maps seed `activity[]` and logAct() writes (src/core/store.js):
-- {id, by, verb, task, project, at, extra}. `verb` is free text ('moved',
-- 'completed', 'created project', 'added a file to', …).
-- -----------------------------------------------------------------------------
CREATE TABLE activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id    uuid REFERENCES members(id) ON DELETE SET NULL,  -- by
  verb         text NOT NULL,
  task_id      uuid REFERENCES tasks(id) ON DELETE SET NULL,
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  extra        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()               -- at
);

-- -----------------------------------------------------------------------------
-- notifications
-- Maps seed `notifs[]` and inbox items: {id, type, by, task, project, text,
-- snippet, at, read}. type: mention|assign|comment|update.
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type         notif_type NOT NULL,
  actor_id     uuid REFERENCES members(id) ON DELETE SET NULL,   -- by (null = system)
  task_id      uuid REFERENCES tasks(id) ON DELETE SET NULL,
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  text         text NOT NULL,
  snippet      text NOT NULL DEFAULT '',
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()                -- at
);

-- -----------------------------------------------------------------------------
-- files
-- Replaces BOTH D().files[] ({id, project, name, type, size, by, at, task})
-- and task.attachments[] (duplicated records in the seed — f1/f2 == a1/a2).
-- size is a display string in the app ("4.2 MB") -> size_bytes BIGINT.
-- storage_path is NULL for seed-only records.
-- -----------------------------------------------------------------------------
CREATE TABLE files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id      uuid REFERENCES tasks(id) ON DELETE SET NULL,     -- NULL = project-level file (kept when its task is deleted, like the app)
  name         text NOT NULL,
  type         file_type NOT NULL DEFAULT 'other',
  size_bytes   bigint NOT NULL DEFAULT 0,
  uploader_id  uuid REFERENCES members(id) ON DELETE SET NULL,  -- by
  storage_path text,
  created_at   timestamptz NOT NULL DEFAULT now()               -- at
);

-- -----------------------------------------------------------------------------
-- events
-- Maps seed `events[]`: {id, title, date, time, project}. Read-only calendar
-- items (no create/edit UI in the prototype).
-- -----------------------------------------------------------------------------
CREATE TABLE events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  date       date NOT NULL,
  time       time NOT NULL,   -- '10:00'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- saved_views
-- Maps D().savedViews[]: {id, project, name, type, filters}.
-- type: 'list' | 'board' | 'table' (save-view modal — src/overlays/modals.js).
-- filters: [{f, op: 'is'|'not', v: [ids]}] where f is a FIELDS key
-- (status, assignee, priority, due, project, labels, created, updated).
-- -----------------------------------------------------------------------------
CREATE TABLE saved_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL,
  type       text NOT NULL DEFAULT 'list' CHECK (type IN ('list', 'board', 'table')),
  filters    jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- user_preferences
-- Maps S.prefs (DEFAULT_PREFS + keys added in settings — src/core/store.js,
-- src/pages/settings.js), the persisted `collapsed` sidebar flag, plus
-- D().tfa and D().notifPrefs.
--
-- notif_prefs keys used by the app:
--   email_mention, email_assign, email_digest, email_comment,
--   push_mention, push_assign, push_comment, push_due,
--   mention_all, mention_team, mention_ws,
--   assign_self, assign_status, assign_over
-- -----------------------------------------------------------------------------
CREATE TABLE user_preferences (
  user_id                 uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme                   text NOT NULL DEFAULT 'system'  CHECK (theme IN ('light', 'dark', 'system')),
  accent                  text NOT NULL DEFAULT 'indigo', -- indigo|blue|violet|teal|rose|graphite
  sidebar_density         text NOT NULL DEFAULT 'comfortable' CHECK (sidebar_density IN ('comfortable', 'compact')),
  density                 text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'compact')),
  week_start              smallint NOT NULL DEFAULT 1 CHECK (week_start BETWEEN 0 AND 6),
  date_format             text NOT NULL DEFAULT 'MMM d',  -- 'MMM d'|'d/M'|'M/d'|'yyyy-MM-dd'
  language                text NOT NULL DEFAULT 'English (US)',
  timezone                text NOT NULL DEFAULT '(GMT-07:00) Pacific Time',
  motion                  text NOT NULL DEFAULT 'system' CHECK (motion IN ('system', 'full', 'reduce')),
  home                    text NOT NULL DEFAULT 'home',   -- home|mytasks|inbox
  open_tasks              text NOT NULL DEFAULT 'drawer' CHECK (open_tasks IN ('drawer', 'full')),
  name                    text,                           -- profile name (P.name)
  title                   text,                           -- profile title (P.title)
  spellcheck              boolean NOT NULL DEFAULT true,
  time_format             text NOT NULL DEFAULT '12',     -- '12'|'24'
  show_done_board         boolean NOT NULL DEFAULT true,
  members_create_projects boolean NOT NULL DEFAULT true,  -- permCreate
  members_invite_guests   boolean NOT NULL DEFAULT true,  -- permGuests
  public_share_links      boolean NOT NULL DEFAULT false, -- permPublic
  confirm_delete          boolean NOT NULL DEFAULT true,  -- confirmDel
  default_tab             text NOT NULL DEFAULT 'board',  -- board|list|table|overview|timeline
  sidebar_collapsed       boolean NOT NULL DEFAULT false, -- localStorage `collapsed`
  active_workspace_id     uuid REFERENCES workspaces(id) ON DELETE SET NULL, -- D().ws
  tfa_enabled             boolean NOT NULL DEFAULT false, -- D().tfa
  notif_prefs             jsonb NOT NULL DEFAULT '{}',    -- D().notifPrefs
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- user_view_states
-- Maps S.views (persisted in the store save): one row per view key
-- ('p:<projectId>', 'tasks', 'mytasks', 'inbox', 'home', 'timeline',
-- 'calendar', …). Shape from viewOf() (src/shell/view-engine.js):
-- {filters, sort: {f, dir}, group, q, hidden, colW, showDone} + mode.
-- -----------------------------------------------------------------------------
CREATE TABLE user_view_states (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_key   text NOT NULL,
  filters    jsonb NOT NULL DEFAULT '[]',
  sort       jsonb NOT NULL DEFAULT '{"f": "manual", "dir": 1}',
  "group"    text NOT NULL DEFAULT 'status',  -- status|priority|assignee|project|due|none
  query      text NOT NULL DEFAULT '',        -- v.q
  hidden_cols jsonb NOT NULL DEFAULT '[]',    -- v.hidden (table columns)
  col_widths jsonb NOT NULL DEFAULT '{}',     -- v.colW {col: px}
  show_done  boolean NOT NULL DEFAULT true,
  mode       text CHECK (mode IN ('list', 'board', 'table')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, view_key)
);

-- -----------------------------------------------------------------------------
-- recent_searches
-- Maps D().recentSearches[] (max 5, newest first — src/overlays/palette.js).
-- -----------------------------------------------------------------------------
CREATE TABLE recent_searches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  term         text NOT NULL,
  position     smallint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, term)
);

-- -----------------------------------------------------------------------------
-- sessions
-- Maps D().sessions[]: {id, dev, loc, at, cur}. `at` is a display string in
-- the app ("Active now", "2 hours ago", "Sep 12") -> last_seen_at.
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device       text NOT NULL,                  -- dev
  location     text,                           -- loc
  is_current   boolean NOT NULL DEFAULT false, -- cur
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- invoices
-- Maps D().invoices[]: {id, date, amt, st}. `amt` display string ("$96.00")
-- -> amount_cents. `st` -> status ('Paid').
-- -----------------------------------------------------------------------------
CREATE TABLE invoices (
  id           text PRIMARY KEY,               -- 'INV-2026-009'
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  issued_on    date NOT NULL,                  -- date
  amount_cents integer NOT NULL,               -- amt
  status       text NOT NULL DEFAULT 'Paid',   -- st
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX idx_members_workspace        ON members (workspace_id);
CREATE INDEX idx_members_team             ON members (team_id);
CREATE INDEX idx_teams_workspace          ON teams (workspace_id);
CREATE INDEX idx_projects_workspace       ON projects (workspace_id);
CREATE INDEX idx_projects_team            ON projects (team_id);
CREATE INDEX idx_tasks_project_status     ON tasks (project_id, status);
CREATE INDEX idx_tasks_project_order      ON tasks (project_id, "order");
CREATE INDEX idx_tasks_assignee           ON tasks (assignee_id);
CREATE INDEX idx_tasks_due                ON tasks (due);
CREATE INDEX idx_subtasks_task            ON subtasks (task_id);
CREATE INDEX idx_comments_task            ON comments (task_id);
CREATE INDEX idx_activity_workspace_at    ON activity (workspace_id, created_at DESC);
CREATE INDEX idx_activity_project         ON activity (project_id);
CREATE INDEX idx_notifications_workspace  ON notifications (workspace_id, created_at DESC);
CREATE INDEX idx_notifications_task       ON notifications (task_id);
CREATE INDEX idx_files_project            ON files (project_id);
CREATE INDEX idx_files_task               ON files (task_id);
CREATE INDEX idx_events_project           ON events (project_id);
CREATE INDEX idx_events_date              ON events (date);
CREATE INDEX idx_saved_views_project      ON saved_views (project_id);
CREATE INDEX idx_milestones_project       ON milestones (project_id);
CREATE INDEX idx_sessions_user            ON sessions (user_id);
CREATE INDEX idx_invoices_workspace       ON invoices (workspace_id);


-- -----------------------------------------------------------------------------
-- updated_at trigger (projects, tasks, user_preferences, user_view_states)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_view_states_set_updated_at
  BEFORE UPDATE ON user_view_states FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------------------------------
-- Fixed vocabulary: labels (mirrors LABELS in src/core/constants.js).
-- Colors = hex behind the CSS vars (light theme — src/styles/tokens.css).
-- -----------------------------------------------------------------------------
INSERT INTO labels (id, name, color) VALUES
  ('design',    'Design',    '#7652c2'), -- var(--violet)
  ('frontend',  'Frontend',  '#3570c4'), -- var(--blue)
  ('backend',   'Backend',   '#1e8580'), -- var(--teal)
  ('research',  'Research',  '#8f5e0e'), -- var(--amber)
  ('content',   'Content',   '#bc4270'), -- var(--rose)
  ('bug',       'Bug',       '#b23c30'), -- var(--red)
  ('qa',        'QA',        '#25754b'), -- var(--green)
  ('growth',    'Growth',    '#c0612b')  -- var(--orange)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Notes
-- -----------------------------------------------------------------------------
-- 1. Remaining seed data (workspaces, members, projects, tasks, comments,
--    activity, notifications, files, events, saved views, sessions, invoices)
--    is migrated from src/data/seed.js by a migration script — not part of
--    this schema file. Note: seed workspaces have no `url`; the migration
--    script must derive it from the name (lowercased slug), mirroring
--    onbFinish() in src/actions/actions.js.
--
-- 2. Default teams (TEAMS_SEED: Design, Engineering, Marketing, Product) are
--    inserted per workspace on first use (mirrors teamsList() in
--    src/core/store.js).
--
-- 3. Row-level security: enable RLS and write policies scoped to the user's
--    workspace membership for: teams, members, projects, project_members,
--    milestones, tasks, task_labels, subtasks, task_dependencies, comments,
--    comment_reactions, activity, notifications, files, events, saved_views,
--    invoices. members.user_id (or the auth session) is the policy anchor;
--    project privacy (projects.private / projects.access) mirrors canSee()
--    in src/core/store.js.
--
-- 4. Key generation: task keys are currently client-side (nextKey,
--    src/actions/actions.js). For concurrency, generate them server-side
--    (sequence per project or INSERT trigger using projects.seq).
