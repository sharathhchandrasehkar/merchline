/**
 * Runs a throwaway PostgreSQL locally (no install needed) for development.
 *   npm run db:local      then, in another terminal:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5433/merchline npm run dev
 */
import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';

const port = Number(process.env.LOCAL_PG_PORT || 5433);
const DIR = path.resolve(process.env.LOCAL_PG_DIR || '.pgdata');
const pg = new EmbeddedPostgres({
  databaseDir: DIR,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
});

const fresh = !(await import('node:fs')).existsSync(path.join(DIR, 'PG_VERSION'));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('merchline');
console.log(`Postgres is running. DATABASE_URL=postgres://postgres:postgres@localhost:${port}/merchline`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
