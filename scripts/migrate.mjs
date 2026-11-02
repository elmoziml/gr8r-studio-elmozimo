import { closePool } from '../server/db/pool.js';
import { runMigrations } from '../server/db/migrate.js';

try {
  const result = await runMigrations();
  console.log('Migrations complete:', result);
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
