import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { PoolClient } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { pool } from '../db.js';
import { buildCatalog } from './generate.js';
import { INDEX_SQL, LOAD_ORDER, SCHEMA_SQL } from './schema.js';

/** COPY text-format escaping. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return '\\N';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

async function copyTable(client: PoolClient, table: string, cols: string[], rows: Iterable<unknown[]>): Promise<number> {
  let n = 0;
  const it = rows[Symbol.iterator]();
  const source = new Readable({
    read() {
      let chunk = '';
      for (let k = 0; k < 2000; k++) {
        const x = it.next();
        if (x.done) { if (chunk) this.push(chunk); this.push(null); return; }
        chunk += x.value.map(cell).join('\t') + '\n'; n++;
      }
      this.push(chunk);
    },
  });
  await pipeline(source, client.query(copyFrom(`COPY ${table} (${cols.join(',')}) FROM STDIN`)));
  return n;
}

export async function isSeeded(): Promise<boolean> {
  const r = await pool.query(`SELECT to_regclass('public.product') AS t`);
  if (!r.rows[0].t) return false;
  const c = await pool.query('SELECT count(*)::int AS n FROM product');
  return c.rows[0].n > 0;
}

/** Drops and rebuilds every table with a deterministic catalog of `styles` styles. */
export async function seed(styles: number, log: (m: string) => void = console.log): Promise<Record<string, number>> {
  const t0 = Date.now();
  const cat = buildCatalog(styles);
  const client = await pool.connect();
  const counts: Record<string, number> = {};
  try {
    await client.query(`DROP TABLE IF EXISTS ${[...LOAD_ORDER].reverse().join(',')} CASCADE`);
    await client.query(SCHEMA_SQL);
    for (const t of LOAD_ORDER) {
      const def = cat.tables[t];
      counts[t] = await copyTable(client, t, def.cols, def.rows());
      log(`[seed] ${t.padEnd(22)} ${counts[t].toLocaleString('en-US')} rows`);
    }
    log('[seed] building indexes…');
    await client.query(INDEX_SQL);
  } finally {
    client.release();
  }
  log(`[seed] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return counts;
}
