/**
 * Trace to season: start from any table, follow every link up to Season, one row per complete path.
 * Each start table has a fixed join chain (taken from the data model diagram); the rows come back
 * as one JSON object per table so the client can show every property as a column group.
 */
import { q } from '../db.js';
import { SEASON_CODES, entity } from '../model.js';

type Step = [entity: string, alias: string, on: string];
interface Chain { alias: string; steps: Step[] }

const PS_TAIL: Step[] = [['Productseason', 'ps', 'ps.productversionid = p.productversionid'], ['Season', 'se', 'se.seasonversionid = ps.seasonversionid']];
const SC_TAIL: Step[] = [['Product', 'p', 'p.productversionid = sc.productversionid'], ...PS_TAIL];
const BP_TAIL: Step[] = [['Sourcingconfiguration', 'sc', 'sc.sourceversionid = bp.sourceversionid'], ...SC_TAIL];
const BL_TAIL: Step[] = [['BOMPart', 'bp', 'bp.bompartid = bl.bompartid'], ...BP_TAIL];
const BL_LIBS = (skip: string): Step[] => ([
  ['Material', 'm', 'm.materialversionid = bl.materialversionid'],
  ['Supplier', 's', 's.supplierversionid = bl.supplierversionid'],
  ['Color', 'c', 'c.colorid = bl.colorid'],
] as Step[]).filter((x) => x[0] !== skip);

export const CHAINS: Record<string, Chain> = {
  Materialcolor: { alias: 'mc', steps: [
    ['Material', 'm', 'm.materialversionid = mc.materialversionid'], ['Supplier', 's', 's.supplierversionid = mc.supplierversionid'], ['Color', 'c', 'c.colorid = mc.colorid'],
    ['Bomlink', 'bl', 'bl.materialversionid = mc.materialversionid AND bl.supplierversionid = mc.supplierversionid AND bl.colorid = mc.colorid'], ...BL_TAIL] },
  Material: { alias: 'm', steps: [['Bomlink', 'bl', 'bl.materialversionid = m.materialversionid'], ...BL_LIBS('Material'), ...BL_TAIL] },
  Materialsupplier: { alias: 'ms', steps: [
    ['Material', 'm', 'm.materialversionid = ms.materialversionid'], ['Supplier', 's', 's.supplierversionid = ms.supplierversionid'],
    ['Bomlink', 'bl', 'bl.materialversionid = ms.materialversionid AND bl.supplierversionid = ms.supplierversionid'], ['Color', 'c', 'c.colorid = bl.colorid'], ...BL_TAIL] },
  Supplier: { alias: 's', steps: [['Bomlink', 'bl', 'bl.supplierversionid = s.supplierversionid'], ...BL_LIBS('Supplier'), ...BL_TAIL] },
  Color: { alias: 'c', steps: [['Bomlink', 'bl', 'bl.colorid = c.colorid'], ...BL_LIBS('Color'), ...BL_TAIL] },
  Bomlink: { alias: 'bl', steps: [...BL_LIBS(''), ...BL_TAIL] },
  BOMPart: { alias: 'bp', steps: BP_TAIL },
  Sourcingconfiguration: { alias: 'sc', steps: SC_TAIL },
  Costsheet: { alias: 'cs', steps: [['Sourcingconfiguration', 'sc', 'sc.sourceversionid = cs.sourceversionid'], ...SC_TAIL] },
  Skucostsheet: { alias: 'scs', steps: [
    ['Sku', 'k', 'k.skuid = scs.skuid'], ['Product', 'p', 'p.productversionid = k.productversionid'], ['Sourcingconfiguration', 'sc', 'sc.sourceversionid = scs.sourceversionid'],
    ['Skuseason', 'ss', 'ss.skuid = scs.skuid AND ss.seasonversionid = scs.seasonversionid'], ['Season', 'se', 'se.seasonversionid = scs.seasonversionid']] },
  Sku: { alias: 'k', steps: [['Product', 'p', 'p.productversionid = k.productversionid'], ['Skuseason', 'ss', 'ss.skuid = k.skuid'], ['Season', 'se', 'se.seasonversionid = ss.seasonversionid']] },
  Skuseason: { alias: 'ss', steps: [['Sku', 'k', 'k.skuid = ss.skuid'], ['Product', 'p', 'p.productversionid = k.productversionid'], ['Season', 'se', 'se.seasonversionid = ss.seasonversionid']] },
  Product: { alias: 'p', steps: PS_TAIL },
  Productseason: { alias: 'ps', steps: [['Product', 'p', 'p.productversionid = ps.productversionid'], ['Season', 'se', 'se.seasonversionid = ps.seasonversionid']] },
};
export const TRACE_STARTS = Object.keys(CHAINS);

export interface TraceArgs { start: string; q?: string; id?: string; seasons?: string[] }

function build(a: TraceArgs) {
  const chain = CHAINS[a.start];
  if (!chain) throw Object.assign(new Error(`Can't trace from ${a.start}`), { status: 400 });
  const se = entity(a.start)!;
  const joins = chain.steps.map(([e, al, on]) => `JOIN ${entity(e)!.table} ${al} ON ${on}`).join('\n');
  const params: unknown[] = [];
  const where: string[] = [];
  if (a.id) { params.push(a.id); where.push(`${chain.alias}.${se.pk} = $${params.length}`); }
  else if (a.q && a.q.trim()) {
    params.push(`%${a.q.trim()}%`, a.q.trim().toUpperCase());
    where.push(`(${chain.alias}.label ILIKE $${params.length - 1} OR ${chain.alias}.${se.pk} = $${params.length})`);
  }
  const seasons = (a.seasons || []).filter((s) => SEASON_CODES.includes(s));
  if (seasons.length) { params.push(seasons); where.push(`se.code = ANY($${params.length})`); }
  const from = `FROM ${se.table} ${chain.alias}\n${joins}\n${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
  const groups = [a.start, ...chain.steps.map((s) => s[0])];
  const aliases = [chain.alias, ...chain.steps.map((s) => s[1])];
  return { chain, se, from, params, groups, aliases };
}

/** One page of paths. */
export async function traceRows(a: TraceArgs, offset: number, limit: number) {
  const b = build(a);
  const select = b.groups.map((g, i) => `to_jsonb(${b.aliases[i]}) AS "${g}"`).join(', ');
  const order = b.groups.map((g, i) => `${b.aliases[i]}.${entity(g)!.pk}`).join(', ');
  const rows = await q(`SELECT ${select} ${b.from} ORDER BY ${order} LIMIT $${b.params.length + 1} OFFSET $${b.params.length + 2}`, [...b.params, limit, offset]);
  return { groups: b.groups, joins: b.chain.steps.map(([e, , on]) => ({ entity: e, on })), rows };
}

/** Totals for the summary tiles: paths, distinct styles reached and paths per season. */
export async function traceSummary(a: TraceArgs) {
  const b = build(a);
  const rows = await q<{ code: string | null; paths: number; styles: number }>(
    `SELECT se.code, count(*)::int AS paths, count(DISTINCT p.productversionid)::int AS styles ${b.from} GROUP BY GROUPING SETS ((se.code), ())`, b.params);
  const total = rows.find((r) => r.code === null) || { paths: 0, styles: 0 };
  const bySeason = Object.fromEntries(rows.filter((r) => r.code).map((r) => [r.code as string, r.paths]));
  return { paths: total.paths, styles: total.styles, bySeason };
}
