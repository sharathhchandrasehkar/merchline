import { q } from '../db.js';
import { ENTITIES, RELATIONS, entity, relKey, type Entity } from '../model.js';

export interface Item { entity: string; id: string; label: string; metric: string | null; thumb: unknown }
const ITEM_COLS = (e: Entity, a = '') => `${a}${e.pk} AS id, ${a}label, ${a}metric, ${a}thumb`;
const toItems = (e: Entity, rows: Record<string, unknown>[]): Item[] =>
  rows.map((r) => ({ entity: e.name, id: String(r.id), label: String(r.label), metric: (r.metric as string) ?? null, thumb: r.thumb }));

/** Exact table sizes, refreshed after seeding. Cheap enough to compute once per process. */
let countCache: Record<string, number> | null = null;
export async function tableCounts(force = false): Promise<Record<string, number>> {
  if (countCache && !force) return countCache;
  const parts = ENTITIES.map((e) => `SELECT '${e.name}' AS e, count(*)::int AS n FROM ${e.table}`).join(' UNION ALL ');
  const rows = await q<{ e: string; n: number }>(parts);
  countCache = Object.fromEntries(rows.map((r) => [r.e, r.n]));
  return countCache;
}
export function resetCaches() { countCache = null; }

/** Paged list with optional search on the display name (or an exact ID). */
export async function listEntity(e: Entity, search: string, offset: number, limit: number) {
  const s = search.trim();
  if (!s) {
    const [items, counts] = await Promise.all([
      q(`SELECT ${ITEM_COLS(e)} FROM ${e.table} ORDER BY ${e.pk} LIMIT $1 OFFSET $2`, [limit, offset]),
      tableCounts(),
    ]);
    return { total: counts[e.name] ?? 0, items: toItems(e, items) };
  }
  const where = `(label ILIKE $1 OR ${e.pk} = $2)`;
  const args = [`%${s}%`, s.toUpperCase()];
  const [items, total] = await Promise.all([
    q(`SELECT ${ITEM_COLS(e)} FROM ${e.table} WHERE ${where} ORDER BY ${e.pk} LIMIT $3 OFFSET $4`, [...args, limit, offset]),
    q<{ n: number }>(`SELECT count(*)::int AS n FROM ${e.table} WHERE ${where}`, args),
  ]);
  return { total: total[0].n, items: toItems(e, items) };
}

/** One record, with every foreign key resolved to a small item for display. */
export async function getRecord(e: Entity, id: string) {
  const rows = await q(`SELECT * FROM ${e.table} WHERE ${e.pk} = $1`, [id]);
  if (!rows.length) return null;
  const row = rows[0];
  const refs: Record<string, Item> = {};
  await Promise.all(e.fields.filter((f) => f.type === 'fk' && f.ref && row[f.key]).map(async (f) => {
    const re = entity(f.ref!)!;
    const r = await q(`SELECT ${ITEM_COLS(re)} FROM ${re.table} WHERE ${re.pk} = $1`, [row[f.key]]);
    if (r.length) refs[f.key] = toItems(re, r)[0];
  }));
  return { entity: e.name, id, row, refs };
}

export interface Group { key: string; dir: 'up' | 'down'; entity: string; keys: string[]; title: string; total: number; items: Item[] }

/** Every relationship of a record: parents it belongs to ("up") and children it contains ("down"). */
export async function relatedGroups(e: Entity, row: Record<string, unknown>, firstPage = 6): Promise<Group[]> {
  const out: Promise<Group>[] = [];
  for (const r of RELATIONS) {
    if (r.child === e.name) {
      const pe = entity(r.parent)!;
      out.push(q(`SELECT ${ITEM_COLS(pe)} FROM ${pe.table} WHERE ${r.keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ')} LIMIT 1`, r.keys.map((k) => row[k]))
        .then((rows) => ({ key: relKey(r), dir: 'up' as const, entity: pe.name, keys: r.keys, title: r.partOf, total: rows.length, items: toItems(pe, rows) })));
    }
    if (r.parent === e.name) {
      out.push(relatedPage(r.child, r.keys, row, 0, firstPage).then((p) => ({
        key: relKey(r), dir: 'down' as const, entity: r.child, keys: r.keys, title: r.contains, total: p.total, items: p.items })));
    }
  }
  return Promise.all(out);
}

export async function relatedPage(childName: string, keys: string[], row: Record<string, unknown>, offset: number, limit: number) {
  const ce = entity(childName)!;
  const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
  const vals = keys.map((k) => row[k]);
  const [items, total] = await Promise.all([
    q(`SELECT ${ITEM_COLS(ce)} FROM ${ce.table} WHERE ${where} ORDER BY ${ce.pk} LIMIT $${keys.length + 1} OFFSET $${keys.length + 2}`, [...vals, limit, offset]),
    q<{ n: number }>(`SELECT count(*)::int AS n FROM ${ce.table} WHERE ${where}`, vals),
  ]);
  return { total: total[0].n, items: toItems(ce, items) };
}

/** Search across the main tables, plus exact ID lookups for any table. */
const SEARCHABLE = ['Product', 'Material', 'Supplier', 'Color', 'Sku', 'Materialcolor'];
const PREFIX: Record<string, string> = { SV: 'Season', PV: 'Product', SKU: 'Sku', PS: 'Productseason', SS: 'Skuseason', SC: 'Sourcingconfiguration', BP: 'BOMPart',
  BL: 'Bomlink', CS: 'Costsheet', SCS: 'Skucostsheet', SP: 'Supplier', MV: 'Material', CL: 'Color', MS: 'Materialsupplier', MC: 'Materialcolor' };
export async function searchAll(text: string): Promise<Item[]> {
  const s = text.trim();
  if (s.length < 2) return [];
  const out: Item[] = [];
  const pre = PREFIX[s.toUpperCase().split('-')[0]];
  if (pre) {
    const e = entity(pre)!;
    out.push(...toItems(e, await q(`SELECT ${ITEM_COLS(e)} FROM ${e.table} WHERE ${e.pk} = $1`, [s.toUpperCase()])));
  }
  const lists = await Promise.all(SEARCHABLE.map((n) => {
    const e = entity(n)!;
    return q(`SELECT ${ITEM_COLS(e)} FROM ${e.table} WHERE label ILIKE $1 ORDER BY length(label), ${e.pk} LIMIT 4`, [`%${s}%`]).then((r) => toItems(e, r));
  }));
  lists.forEach((l) => out.push(...l));
  return out.slice(0, 16);
}
