import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';

const MIGRATIONS_DIR = path.resolve(fileURLToPath(new URL('../../database/migrations', import.meta.url)));
const LOCK_NAME = 'gr8r_schema_migrations';

async function listMigrations() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => ({
      id: entry.name,
      path: path.join(MIGRATIONS_DIR, entry.name),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function ensureMigrationTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      id         text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function tableExists(client, name) {
  const result = await client.query('select to_regclass($1) is not null as exists', [`public.${name}`]);
  return result.rows[0].exists;
}

export async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock(hashtext($1))', [LOCK_NAME]);
    await ensureMigrationTable(client);

    const appliedResult = await client.query('select id from schema_migrations order by id');
    const applied = new Set(appliedResult.rows.map(row => row.id));
    const migrations = await listMigrations();
    const executed = [];

    if (!applied.size && (await tableExists(client, 'workspaces'))) {
      const baseline = migrations[0];
      if (baseline) {
        await client.query('insert into schema_migrations (id) values ($1) on conflict do nothing', [baseline.id]);
        applied.add(baseline.id);
        executed.push(`${baseline.id} (baseline)`);
      }
    }

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      const sql = await fs.readFile(migration.path, 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (id) values ($1)', [migration.id]);
        await client.query('commit');
        executed.push(migration.id);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${migration.id} failed: ${error.message}`);
      }
    }

    return { applied: [...applied].sort(), executed };
  } finally {
    await client.query('select pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => {});
    client.release();
  }
}

export async function migrationState() {
  const pool = getPool();
  const migrations = await listMigrations();
  const table = await pool.query("select to_regclass('public.schema_migrations') is not null as exists");
  if (!table.rows[0].exists) return { ready: false, applied: 0, total: migrations.length, pending: migrations.map(item => item.id) };
  const applied = await pool.query('select id from schema_migrations order by id');
  const appliedIds = new Set(applied.rows.map(row => row.id));
  return {
    ready: migrations.every(item => appliedIds.has(item.id)),
    applied: applied.rows.length,
    total: migrations.length,
    pending: migrations.filter(item => !appliedIds.has(item.id)).map(item => item.id),
  };
}
