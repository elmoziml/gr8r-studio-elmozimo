import { ensureSessionSecret, getDatabaseConfig } from '../config.js';
import { getPool, testDatabaseConnection } from '../db/pool.js';
import { migrationState, runMigrations } from '../db/migrate.js';
import { createOwnerWorkspace } from '../db/create-workspace.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readSetupCompleted() {
  const { url } = getDatabaseConfig();
  if (!url) return false;
  try {
    const pool = getPool();
    const table = await pool.query("select to_regclass('public.app_settings') is not null as exists");
    if (!table.rows[0].exists) return false;
    const result = await pool.query("select value from app_settings where key = 'setup_completed'");
    return Boolean(result.rows[0]?.value?.completed);
  } catch {
    return false;
  }
}

export async function getSetupStatus() {
  const config = getDatabaseConfig();
  const status = {
    configured: Boolean(config.url),
    source: config.source,
    connected: false,
    schemaReady: false,
    initialized: false,
    tables: 0,
    migrations: null,
    error: null,
  };

  if (!config.url) return status;

  try {
    const pool = getPool();
    await pool.query('select 1');
    status.connected = true;
    const tables = await pool.query("select count(*)::int as count from information_schema.tables where table_schema = 'public'");
    status.tables = tables.rows[0].count;
    const workspaces = await pool.query("select to_regclass('public.workspaces') is not null as exists");
    if (workspaces.rows[0].exists) {
      const migrations = await migrationState();
      status.migrations = migrations;
      status.schemaReady = migrations.ready;
      const settings = await pool.query("select to_regclass('public.app_settings') is not null as exists");
      if (settings.rows[0].exists) {
        const result = await pool.query("select value from app_settings where key = 'setup_completed'");
        status.initialized = Boolean(result.rows[0]?.value?.completed);
      }
    }
  } catch (error) {
    status.error = error.message;
  }

  return status;
}

async function connectionGuard(request) {
  const token = String(process.env.SETUP_TOKEN || '');
  if (token && request.headers['x-setup-token'] !== token) throw httpError(401, 'Invalid setup token');
  if (await readSetupCompleted()) throw httpError(403, 'Setup is already complete');
}

function validateAdmin(admin) {
  const name = String(admin?.name || '').trim();
  const email = String(admin?.email || '')
    .trim()
    .toLowerCase();
  const password = String(admin?.password || '');
  if (!name) throw httpError(422, 'Admin name is required');
  if (!EMAIL_RE.test(email)) throw httpError(422, 'A valid admin email is required');
  if (password.length < 10 || !/[0-9\W]/.test(password)) throw httpError(422, 'Password must be at least 10 characters and include a number or symbol');
  return { name, email, password };
}

export default async function setupRoutes(fastify) {
  fastify.get('/api/setup/status', async () => ({ data: await getSetupStatus() }));

  fastify.post('/api/setup/test-connection', { preHandler: connectionGuard }, async () => {
    const info = await testDatabaseConnection();
    return { data: { ok: true, ...info } };
  });

  fastify.post('/api/setup/migrate', { preHandler: connectionGuard }, async () => {
    const result = await runMigrations();
    return { data: { ok: true, ...result, status: await getSetupStatus() } };
  });

  fastify.post('/api/setup/install', { preHandler: connectionGuard }, async request => {
    const body = request.body || {};
    if (!getDatabaseConfig().url) throw httpError(400, 'DATABASE_URL is not set in the environment');

    await runMigrations();

    const admin = validateAdmin(body.admin);
    const workspace = {
      name: String(body.workspace?.name || '').trim() || 'My Workspace',
      url: body.workspace?.url,
    };

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', ['gr8r_setup_install']);
      const completed = await client.query("select value from app_settings where key = 'setup_completed'");
      if (completed.rows[0]?.value?.completed) throw httpError(409, 'Setup is already complete');

      const result = await createOwnerWorkspace(client, { admin, workspace, demoData: Boolean(body.demoData) });
      await client.query('insert into app_settings (key, value) values ($1, $2)', [
        'setup_completed',
        JSON.stringify({
          completed: true,
          completedAt: new Date().toISOString(),
          adminEmail: admin.email,
          workspaceId: result.workspaceId,
        }),
      ]);
      await client.query('commit');
      ensureSessionSecret();
      return {
        data: {
          ok: true,
          initialized: true,
          ...result,
          status: await getSetupStatus(),
        },
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });
}
