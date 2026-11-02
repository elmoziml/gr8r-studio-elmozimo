import pg from 'pg';
import { getDatabaseConfig, redactDatabaseUrl } from '../config.js';

const { Client, Pool } = pg;

let pool = null;
let poolUrl = null;

export function getPool() {
  const { url } = getDatabaseConfig();
  if (!url) throw new Error('DATABASE_NOT_CONFIGURED');
  if (!pool || poolUrl !== url) {
    if (pool) pool.end().catch(() => {});
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    poolUrl = url;
    pool.on('error', error => console.error(`Postgres pool error (${redactDatabaseUrl(url)}):`, error.message));
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    const current = pool;
    pool = null;
    poolUrl = null;
    await current.end().catch(() => {});
  }
}

export async function testDatabaseConnection() {
  const { url } = getDatabaseConfig();
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await client.query(`
      select
        current_database() as database,
        current_user as user,
        version() as version,
        has_database_privilege(current_user, current_database(), 'CREATE') as can_create,
        (select count(*)::int from information_schema.tables where table_schema = 'public') as tables
    `);
    return { ...result.rows[0], url: redactDatabaseUrl(url) };
  } finally {
    await client.end().catch(() => {});
  }
}
