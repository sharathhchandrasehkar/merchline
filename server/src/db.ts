import pg from 'pg';

/** One shared pool. DATABASE_URL works for Neon, Render, Supabase or a local Postgres. */
const url = process.env.DATABASE_URL;
if (!url) console.warn('[db] DATABASE_URL is not set; the API will fail on the first query.');
const needsSsl = !!url && !/localhost|127\.0\.0\.1/.test(url) && !/sslmode=disable/.test(url);

export const pool = new pg.Pool({
  connectionString: url,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX || 5),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15000),
});

// numeric columns come back as strings by default; money and rates fit safely in a double
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}
