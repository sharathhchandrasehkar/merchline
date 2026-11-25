import { q } from '../db.js';
import { SEASON_CODES } from '../model.js';
import { CATEGORIES } from '../seed/generate.js';
import { tableCounts } from './records.js';

let cache: { at: number; data: unknown } | null = null;

/** Catalog overview: table sizes, a category × season matrix and the styles with the weakest margin. */
export async function overview(force = false) {
  if (cache && !force && Date.now() - cache.at < 10 * 60_000) return cache.data;
  const [counts, styles, colorways, margin, watch] = await Promise.all([
    tableCounts(force),
    q<{ category: string; code: string; n: number }>(`SELECT p.category, se.code, count(*)::int AS n FROM productseason ps
      JOIN product p ON p.productversionid = ps.productversionid JOIN season se ON se.seasonversionid = ps.seasonversionid GROUP BY 1, 2`),
    q<{ category: string; code: string; n: number }>(`SELECT p.category, se.code, count(*)::int AS n FROM skuseason ss
      JOIN sku k ON k.skuid = ss.skuid JOIN product p ON p.productversionid = k.productversionid JOIN season se ON se.seasonversionid = ss.seasonversionid GROUP BY 1, 2`),
    q<{ category: string; code: string; n: number }>(`SELECT p.category, se.code, avg(scs.margin_pct)::float AS n FROM skucostsheet scs
      JOIN sku k ON k.skuid = scs.skuid JOIN product p ON p.productversionid = k.productversionid JOIN season se ON se.seasonversionid = scs.seasonversionid GROUP BY 1, 2`),
    q(`SELECT p.productversionid AS id, p.label, p.metric, p.thumb, p.category, avg(scs.margin_pct)::float AS margin, count(DISTINCT k.skuid)::int AS colorways
      FROM skucostsheet scs JOIN sku k ON k.skuid = scs.skuid JOIN product p ON p.productversionid = k.productversionid
      WHERE p.status <> 'Dropped' GROUP BY p.productversionid ORDER BY margin ASC LIMIT 8`),
  ]);
  const grid = (rows: { category: string; code: string; n: number }[]) =>
    CATEGORIES.map((c) => SEASON_CODES.map((s) => rows.find((r) => r.category === c && r.code === s)?.n ?? null));
  const data = { counts, categories: CATEGORIES, seasons: SEASON_CODES,
    matrix: { styles: grid(styles), colorways: grid(colorways), margin: grid(margin) }, watch };
  cache = { at: Date.now(), data };
  return data;
}
export function resetOverview() { cache = null; }
