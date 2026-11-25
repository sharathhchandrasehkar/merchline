/**
 * Deterministic synthetic catalog generator.
 *
 * Every attribute is a hash of a record's index, so the same STYLES count always produces the same
 * data, and each table can be streamed straight into Postgres without holding the catalog in memory.
 */
import { SEASON_CODES } from '../model.js';

// ---------- deterministic randomness ----------
function h32(i: number, s: number): number {
  let x = Math.imul((i + 1) ^ Math.imul(s, 0x9e3779b1), 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  x = Math.imul(x ^ (s * 7919), 0x27d4eb2f); x ^= x >>> 15; return x >>> 0;
}
const rr = (i: number, s: number) => h32(i, s) / 4294967296;
const pick = (r: number, w: number[]) => { let a = 0; for (let k = 0; k < w.length; k++) { a += w[k]; if (r < a) return k; } return w.length - 1; };
const pad = (n: number, w: number) => String(n).padStart(w, '0');
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------- vocabularies ----------
export const CATEGORIES = ['Outerwear', 'Tops', 'Fleece', 'Bottoms', 'Insulated'];
const GENDERS = ['Men', 'Women', 'Unisex', 'Kids'];
const STATUSES = ['Active', 'In development', 'Concept', 'Dropped'];
const COUNTRIES = ['Vietnam', 'China', 'Bangladesh', 'Türkiye', 'India', 'Indonesia', 'Portugal'];
const ISO: Record<string, string> = { Japan: 'JP', 'New Zealand': 'NZ', China: 'CN', 'Türkiye': 'TR', Vietnam: 'VN', Bangladesh: 'BD', India: 'IN', Indonesia: 'ID', Portugal: 'PT', Taiwan: 'TW', Korea: 'KR', Italy: 'IT' };
const SEASON_NAMES: Record<string, string> = { SS25: 'Spring/Summer 2025', FW25: 'Fall/Winter 2025', SS26: 'Spring/Summer 2026', FW26: 'Fall/Winter 2026', SS27: 'Spring/Summer 2027' };
const SEASON_STATUS = ['Closed', 'In Market', 'In Market', 'In Development', 'Planning'];
const SKUSEASON_STATUS = ['Closed', 'Active', 'Active', 'Costing', 'Concept'];
const CAT = {
  sil: ['jacket', 'tee', 'hoodie', 'pant', 'vest'], code: ['OW', 'TP', 'FL', 'BT', 'IN'], base: [0.62, 0.58, 0.6, 0.55, 0.64],
  fob: [26, 9, 16, 13, 22], duty: [0.071, 0.165, 0.16, 0.149, 0.071],
  nouns: [['Shell Jacket', 'Rain Jacket', 'Softshell', 'Anorak', 'Parka', 'Windbreaker'], ['Crew Tee', 'Long Sleeve Tee', 'Polo', 'Tank', 'Henley'],
    ['Fleece Hoodie', 'Quarter Zip', 'Grid Fleece', 'Pullover'], ['Cargo Pant', 'Hiking Short', 'Jogger', 'Trail Pant', 'Climbing Pant'],
    ['Down Vest', 'Puffer Vest', 'Synthetic Vest', 'Hybrid Vest']],
};
const ADJ = ['Ridgeline', 'Basecamp', 'Trailhead', 'Featherline', 'Summit', 'Northwind', 'Alpine', 'Cascade', 'Granite', 'Driftwood', 'Harbor', 'Canyon', 'Glacier',
  'Ember', 'Fjord', 'Timberline', 'Meridian', 'Sierra', 'Tundra', 'Coastal', 'Highland', 'Boulder', 'Pioneer', 'Quarry', 'Redwood', 'Saltmarsh', 'Skyline',
  'Stormfront', 'Switchback', 'Woodland'];
export const COLORS: [string, string][] = [['Black', '#1d1d1f'], ['Glacier White', '#eef1f2'], ['Moss', '#5a6b3c'], ['Harbor Navy', '#1f2f4d'], ['Ember', '#c4522a'],
  ['Slate', '#6b7680'], ['Sand', '#cbb894'], ['Fjord Blue', '#3d7ea6'], ['Pine', '#2f4a3a'], ['Rust', '#9a4a2a'], ['Mustard', '#c99a2e'], ['Plum', '#5b3550'],
  ['Sky', '#8fb6d6'], ['Charcoal', '#3a3d42'], ['Olive', '#6b6a3a'], ['Coral', '#e07a5f'], ['Stone', '#a8a294'], ['Teal', '#2f7a78'], ['Burgundy', '#6d2333'],
  ['Lichen', '#9fae8a'], ['Cobalt', '#2c4fa3'], ['Clay', '#b9876a'], ['Ink', '#22263a'], ['Heather Grey', '#9a9ca3']];
const COUNTRY_MULT = [1, 0.97, 0.9, 1.12, 0.93, 0.95, 1.3];
const FACTORIES: Record<string, string[]> = { Vietnam: ['Saigon Apparel JSC', 'Hanoi Outdoor Co.'], China: ['Guangzhou Outdoor Garments', 'Ningbo Knitwear'],
  Bangladesh: ['Dhaka Knit Composite', 'Chittagong Garments'], 'Türkiye': ['Ege Konfeksiyon', 'Bursa Tekstil'], India: ['Tiruppur Knits', 'Bengaluru Apparel'],
  Indonesia: ['Bandung Garment Works', 'Semarang Apparel'], Portugal: ['Porto Têxtil', 'Braga Confeções'] };
// BOM sections: name, weight in the BOM, supplier type, section group, base material names
const SECTIONS: [string, number, number, string, string[]][] = [
  ['Body fabric', 0.5, 0, 'Shell', ['3L Nylon Ripstop', 'Stretch Twill', 'Merino Jersey', 'Recycled Microfleece', 'Organic Cotton Jersey', 'Poly Taffeta']],
  ['Lining', 0.1, 0, 'Interior', ['Mesh Lining 50D', 'Tricot Lining', 'Brushed Poly']],
  ['Insulation', 0.13, 2, 'Interior', ['700FP Down', 'Synthetic Fill 80g', 'Recycled Batting']],
  ['Trims & hardware', 0.16, 1, 'Trims', ['#5 Coil Zipper', 'Cord Lock', 'Snap Button', 'Elastic Cord', 'Velcro Tab']],
  ['Labels', 0.06, 3, 'Labels', ['Woven Label', 'Care Label', 'Size Tab']],
  ['Packaging', 0.05, 3, 'Packaging', ['Polybag', 'Hang Tag', 'Carton Insert']]];
const PLACE: Record<string, string[]> = { 'Body fabric': ['Body', 'Sleeves', 'Hood', 'Front panels', 'Back panel', 'Yoke'], Lining: ['Body lining', 'Sleeve lining', 'Pocket bags'],
  Insulation: ['Body fill', 'Sleeve fill', 'Hood fill'], 'Trims & hardware': ['Center front zip', 'Pocket zip', 'Hem drawcord', 'Cuff snap', 'Hood cord'],
  Labels: ['Neck label', 'Care label', 'Size tab'], Packaging: ['Polybag', 'Hang tag', 'Carton insert'] };
const UOM: Record<string, string> = { 'Body fabric': 'm', Lining: 'm', Insulation: 'kg' };
const SUP_TYPES = ['Fabric mill', 'Trims', 'Insulation', 'Labels & packaging'];
const SUP_W1 = ['Kaiyo', 'Nordwool', 'Huayang', 'Anatolia', 'Alpine', 'Mekong', 'Lotus', 'Pacific', 'Andes', 'Baltic', 'Hanse', 'Sakura', 'Delta', 'Orient',
  'Saffron', 'Coral', 'Jade', 'Atlas', 'Vega', 'Boreal', 'Sierra', 'Monsoon', 'Ganges', 'Bosporus'];
const SUP_W2 = [['Textile Co.', 'Mills', 'Weaving', 'Knit Works', 'Fabrics'], ['Trims Ltd.', 'Hardware', 'Components', 'Accessories'], ['Down Works', 'Insulation', 'Fill Co.'],
  ['Labels', 'Packaging', 'Print & Label']];
const SUP_COUNTRIES = ['Japan', 'China', 'Vietnam', 'Türkiye', 'India', 'Taiwan', 'Korea', 'Italy', 'Portugal', 'Bangladesh'];
const GREIGE = '#b9b1a3';
const texKind = (n: string) => { n = n.toLowerCase();
  if (/ripstop|taffeta/.test(n)) return 'ripstop'; if (/jersey/.test(n)) return 'knit'; if (/twill|brushed/.test(n)) return 'twill';
  if (/down|fill|batting/.test(n)) return 'down'; if (/fleece/.test(n)) return 'fleece'; if (/mesh|tricot/.test(n)) return 'mesh';
  if (/zip/.test(n)) return 'zipper'; if (/cord|elastic|snap|velcro/.test(n)) return 'cordlock'; return 'label'; };
const composition = (n: string) => /Ripstop|Taffeta/.test(n) ? '100% Nylon' : /Twill/.test(n) ? '94% Nylon / 6% Elastane' : /Merino/.test(n) ? '100% Merino wool'
  : /Cotton/.test(n) ? '100% Organic cotton' : /Microfleece|Batting|Synthetic/.test(n) ? '100% Recycled polyester' : /Down/.test(n) ? '90/10 Duck down'
  : /Mesh|Tricot|Brushed|Label|Tab|Polybag/.test(n) ? '100% Polyester' : /Zipper/.test(n) ? 'Nylon coil' : /Cord Lock/.test(n) ? 'POM' : /Snap/.test(n) ? 'Brass'
  : /Elastic/.test(n) ? 'Polyester / rubber' : /Velcro/.test(n) ? 'Nylon hook and loop' : 'Recycled paper';

// thumbnail recipes (rendered as SVG by the frontend)
type Thumb = Record<string, unknown>;
const tGarment = (sil: string, hex: string, dots?: string[]): Thumb => ({ k: 'garment', sil, hex, ...(dots ? { dots } : {}) });
const tTex = (tex: string, hex: string): Thumb => ({ k: 'tex', tex, hex });
const tSeason = (code: string): Thumb => ({ k: 'season', code });
const tBadge = (main: Thumb, small: Thumb): Thumb => ({ k: 'badge', main, small });

export interface Catalog { styles: number; tables: Record<string, { cols: string[]; rows: () => Iterable<unknown[]> }>; }

export function buildCatalog(STYLES: number): Catalog {
  const NSUP = Math.max(40, Math.min(360, Math.round(STYLES / 20)));
  const NMAT = Math.max(120, Math.min(2400, Math.round(STYLES / 4)));
  const NCOL = COLORS.length;

  // ---------- libraries (small, kept in memory) ----------
  const sup = Array.from({ length: NSUP }, (_, s) => {
    const t = pick(rr(s, 901), [0.45, 0.3, 0.1, 0.15]);
    const name = `${SUP_W1[h32(s, 902) % SUP_W1.length]} ${SUP_W2[t][h32(s, 903) % SUP_W2[t].length]}`;
    return { id: 'SP-' + pad(s, 4), name, country: SUP_COUNTRIES[h32(s, 904) % SUP_COUNTRIES.length], type: t, rating: ['A', 'A', 'B', 'B', 'C'][h32(s, 905) % 5] };
  });
  const supByType: number[][] = [[], [], [], []]; sup.forEach((s, i) => supByType[s.type].push(i));
  const matBySec: Record<string, number[]> = {}; SECTIONS.forEach(([n]) => (matBySec[n] = []));
  const mat = Array.from({ length: NMAT }, (_, m) => {
    const si = pick(rr(m, 911), SECTIONS.map((x) => x[1])), [sec, , st] = SECTIONS[si], base = SECTIONS[si][4][h32(m, 912) % SECTIONS[si][4].length];
    const name = `${base} ${String.fromCharCode(65 + (h32(m, 913) % 26))}${10 + (h32(m, 914) % 90)}`;
    const fabric = si < 2;
    matBySec[sec].push(m);
    return { id: 'MV-' + pad(m, 5), code: ['FAB', 'LIN', 'INS', 'TRM', 'LBL', 'PKG'][si] + '-' + pad(m, 4), name, sec, st, tex: texKind(base), comp: composition(base),
      weight: fabric ? `${60 + (h32(m, 916) % 220)} gsm` : si === 2 ? `${600 + (h32(m, 916) % 3) * 50} fill power` : '—' };
  });
  type MS = { id: string; m: number; s: number; price: number; uom: string; moq: number; lead: number };
  type MC = { id: string; m: number; s: number; c: number; status: string };
  const ms: MS[] = [], mc: MC[] = [];
  const msByMat: number[][] = mat.map(() => []), mcByMat: number[][] = mat.map(() => []);
  mat.forEach((M, m) => {
    const pool = supByType[M.st], ns = Math.min(pool.length, 1 + +(rr(m, 917) < 0.4) + +(rr(m, 917) < 0.1));
    const used: number[] = []; for (let k = 0; used.length < ns && k < 12; k++) { const s = pool[h32(m, 920 + k) % pool.length]; if (!used.includes(s)) used.push(s); }
    used.forEach((s, k) => {
      const uom = UOM[M.sec] || 'pc';
      msByMat[m].push(ms.length);
      ms.push({ id: `MS-${pad(m, 5)}-${k}`, m, s, uom, price: r2(uom === 'm' ? 2 + rr(m, 930 + k) * 14 : uom === 'kg' ? 30 + rr(m, 930 + k) * 25 : 0.03 + rr(m, 930 + k) * 0.9),
        moq: [200, 500, 1000, 2000, 5000, 10000][h32(m, 940 + k) % 6], lead: 14 + (h32(m, 950 + k) % 50) });
      const nc = 3 + (h32(m, 960 + k) % 8);
      for (let t = 0; t < nc; t++) { const c = (h32(m, 970 + k) + t * 5) % NCOL; if (mc.some((x) => x.m === m && x.s === s && x.c === c)) continue;
        mcByMat[m].push(mc.length); mc.push({ id: `MC-${pad(m, 5)}-${k}-${pad(c + 1, 2)}`, m, s, c, status: rr(m * 31 + c, 980 + k) < 0.8 ? 'Approved' : 'Pending' }); }
    });
  });

  // ---------- styles (derived on demand) ----------
  const S = (i: number) => {
    const c = pick(rr(i, 1), [0.2, 0.28, 0.14, 0.26, 0.12]), s = pick(rr(i, 2), [0.12, 0.16, 0.22, 0.28, 0.22]);
    const r4 = rr(i, 4), st = s === 4 ? (r4 < 0.5 ? 2 : 1) : s === 3 ? (r4 < 0.6 ? 1 : 0) : r4 < 0.8 ? 0 : 3;
    const cw = 2 + Math.floor(Math.pow(rr(i, 6), 1.6) * 9);
    const r7 = rr(i, 7), cfg = 1 + +(r7 < 0.45) + +(r7 < 0.12);
    const bom = 14 + Math.floor(rr(i, 8) * 40);
    const margin = Math.max(0.25, Math.min(0.8, CAT.base[c] + (rr(i, 10) - 0.5) * 0.26));
    const name = `${ADJ[Math.floor(rr(i, 11) * ADJ.length)]} ${CAT.nouns[c][Math.floor(rr(i, 12) * CAT.nouns[c].length)]}`;
    const col0 = Math.floor(rr(i, 13) * NCOL);
    const country0 = pick(rr(i, 5), [0.32, 0.22, 0.16, 0.1, 0.1, 0.06, 0.04]);
    return { i, c, s, st, cw, cfg, bom, margin, name, col0, country0, gender: pick(rr(i, 3), [0.34, 0.34, 0.22, 0.1]),
      pv: 'PV-' + pad(i, 6), styleNumber: `${CAT.code[c]}-${pad(i, 6)}`, sil: CAT.sil[c] };
  };
  type Style = ReturnType<typeof S>;
  const colorIdx = (st: Style, k: number) => (st.col0 + k * 7) % NCOL;
  const nSeasons = (st: Style) => (st.s < 4 && rr(st.i, 15) < 0.3 ? 2 : 1);
  const factories = (st: Style) => {
    const cs = [st.country0]; for (let k = 1; cs.length < st.cfg && k < 20; k++) { const x = Math.floor(rr(st.i, 40 + k) * 7); if (!cs.includes(x)) cs.push(x); }
    return cs.map((ci, k) => { const cn = COUNTRIES[ci]; return { country: cn, name: FACTORIES[cn][Math.floor(rr(st.i, 60 + k) * 2)], mult: COUNTRY_MULT[ci], role: k ? 'Alternate' : 'Primary' }; });
  };
  const parts = (st: Style) => {
    const secs = SECTIONS.filter((x) => x[0] !== 'Insulation' || st.c === 0 || st.c === 4), tw = secs.reduce((t, x) => t + x[1], 0);
    const ns = secs.map((x) => Math.max(1, Math.floor((st.bom * x[1]) / tw))); let diff = st.bom - ns.reduce((t, x) => t + x, 0);
    while (diff !== 0) { const k = ns.indexOf(Math.max(...ns)); if (diff > 0) { ns[k] += diff; diff = 0; } else { const take = Math.min(-diff, ns[k] - 1); if (!take) break; ns[k] -= take; diff += take; } }
    let start = 0; return secs.map((x, k) => { const o = { name: x[0], group: x[3], n: ns[k], start }; start += ns[k]; return o; });
  };
  const fobBase = (st: Style) => CAT.fob[st.c] * (0.8 + rr(st.i, 20) * 0.5);
  const skuFob = (st: Style, k: number, f: number, fs: ReturnType<typeof factories>) => r2((fobBase(st) + (h32(st.i, 100 + k) % 5) * 0.25) * fs[f].mult);
  const skuLanded = (st: Style, k: number, f: number, fs: ReturnType<typeof factories>) => r2(skuFob(st, k, f, fs) * (1 + CAT.duty[st.c]) + 1.2);
  const retail = (st: Style) => Math.max(15, Math.round((skuLanded(st, 0, 0, factories(st)) / (1 - st.margin)) * 2 / 5) * 5);
  const nVer = (st: Style, k: number) => 1 + Math.floor(rr(st.i, 90 + k) * 3);
  const line = (st: Style, j: number, sec: string) => {
    const pool = matBySec[sec], m = pool[h32(st.i, 300 + j) % pool.length], msl = msByMat[m], x = ms[msl[h32(st.i, 310 + j) % msl.length]];
    let c: number; if (sec === 'Body fabric' || sec === 'Trims & hardware') c = colorIdx(st, h32(st.i, 500 + j) % st.cw);
    else { const mcs = mcByMat[m]; c = mcs.length ? mc[mcs[h32(st.i, 320 + j) % mcs.length]].c : 0; }
    return { m, s: x.s, c };
  };
  const styles = function* () { for (let i = 0; i < STYLES; i++) yield S(i); };
  const supShort = (s: number) => sup[s].name.split(' ')[0];
  const supThumb = (s: number): Thumb => ({ k: 'mono', text: sup[s].name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join(''),
    sub: ISO[sup[s].country] || '', tone: sup[s].type });
  const facThumb = (country: string, alt: boolean): Thumb => ({ k: 'factory', iso: ISO[country] || '', alt });
  const SV = (s: number) => 'SV-' + (1001 + s);

  const tables: Catalog['tables'] = {
    season: { cols: ['seasonversionid', 'code', 'name', 'year', 'status', 'label', 'metric', 'thumb'],
      rows: () => SEASON_CODES.map((code, s) => [SV(s), code, SEASON_NAMES[code], 2000 + +code.slice(2), SEASON_STATUS[s], SEASON_NAMES[code], SEASON_STATUS[s], tSeason(code)]) },
    color: { cols: ['colorid', 'color_code', 'name', 'hex', 'color_family', 'label', 'metric', 'thumb'],
      rows: () => COLORS.map(([name, hex], c) => { const fam = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), code = `${fam}-${pad(100 + c * 7, 3)}`;
        return ['CL-' + pad(c + 1, 2), code, name, hex, fam, name, code, { k: 'swatch', hex }]; }) },
    supplier: { cols: ['supplierversionid', 'name', 'country', 'supplier_type', 'rating', 'label', 'metric', 'thumb'],
      rows: () => sup.map((s, i) => [s.id, s.name, s.country, SUP_TYPES[s.type], s.rating, s.name, `${SUP_TYPES[s.type]} · ${s.country}`, supThumb(i)]) },
    material: { cols: ['materialversionid', 'material_code', 'name', 'material_type', 'composition', 'weight', 'label', 'metric', 'thumb'],
      rows: () => mat.map((M) => [M.id, M.code, M.name, M.sec, M.comp, M.weight, M.name, M.code, tTex(M.tex, GREIGE)]) },
    materialsupplier: { cols: ['materialsupplierid', 'materialversionid', 'supplierversionid', 'unit_price', 'uom', 'currency', 'moq', 'lead_time_days', 'label', 'metric', 'thumb'],
      rows: () => ms.map((x) => [x.id, mat[x.m].id, sup[x.s].id, x.price, x.uom, 'USD', x.moq, x.lead, `${mat[x.m].name} ← ${supShort(x.s)}`, `$${x.price.toFixed(2)} / ${x.uom}`,
        tBadge(tTex(mat[x.m].tex, GREIGE), supThumb(x.s))]) },
    materialcolor: { cols: ['materialcolorid', 'materialversionid', 'supplierversionid', 'colorid', 'lab_dip_status', 'label', 'metric', 'thumb'],
      rows: () => mc.map((x) => [x.id, mat[x.m].id, sup[x.s].id, 'CL-' + pad(x.c + 1, 2), x.status, `${mat[x.m].name} / ${COLORS[x.c][0]}`,
        `Lab dip ${x.status.toLowerCase()} · ${supShort(x.s)}`, tTex(mat[x.m].tex, COLORS[x.c][1])]) },
    product: { cols: ['productversionid', 'style_number', 'name', 'category', 'gender', 'status', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) yield [st.pv, st.styleNumber, st.name, CATEGORIES[st.c], GENDERS[st.gender], STATUSES[st.st], st.name, st.styleNumber,
        tGarment(st.sil, COLORS[colorIdx(st, 0)][1], Array.from({ length: Math.min(st.cw, 4) }, (_, k) => COLORS[colorIdx(st, k)][1]))]; } },
    sku: { cols: ['skuid', 'productversionid', 'sku_name', 'colorway', 'colorid', 'size_range', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) for (let k = 0; k < st.cw; k++) { const ci = colorIdx(st, k), [cn, hex] = COLORS[ci];
        yield [`SKU-${pad(st.i, 6)}-${pad(k, 2)}`, st.pv, `${st.name}, ${cn}`, cn, 'CL-' + pad(ci + 1, 2), st.c === 3 ? '2–14' : st.gender === 3 ? '4–14Y' : 'XS–XXL',
          `${st.name}, ${cn}`, cn, tGarment(st.sil, hex)]; } } },
    productseason: { cols: ['productseasonid', 'productversionid', 'seasonversionid', 'lifecycle', 'planned_units', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) for (let t = 0; t < nSeasons(st); t++) { const code = SEASON_CODES[st.s + t];
        yield [`PS-${pad(st.i, 6)}-${t}`, st.pv, SV(st.s + t), t ? 'Carryover' : 'New', 200 + (h32(st.i, 950 + t) % 40) * 50, `${st.name} · ${code}`, t ? 'Carryover' : 'New',
          tBadge(tGarment(st.sil, COLORS[colorIdx(st, 0)][1]), tSeason(code))]; } } },
    skuseason: { cols: ['skuseasonid', 'skuid', 'seasonversionid', 'status', 'retail_price', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) { const rp = retail(st); for (let k = 0; k < st.cw; k++) for (let t = 0; t < nSeasons(st); t++) {
        const s = st.s + t, code = SEASON_CODES[s], [cn, hex] = COLORS[colorIdx(st, k)];
        yield [`SS-${pad(st.i, 6)}-${pad(k, 2)}-${t}`, `SKU-${pad(st.i, 6)}-${pad(k, 2)}`, SV(s), SKUSEASON_STATUS[s], rp + t * 10, `${st.name}, ${cn} · ${code}`,
          `${SKUSEASON_STATUS[s]} · $${(rp + t * 10).toFixed(2)}`, tBadge(tGarment(st.sil, hex), tSeason(code))]; } } } },
    sourcingconfiguration: { cols: ['sourceversionid', 'productversionid', 'factory', 'country', 'role', 'lead_time_days', 'incoterm', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) { const fs = factories(st); for (let k = 0; k < fs.length; k++) { const f = fs[k], lead = 45 + (h32(st.i, 70 + k) % 60);
        yield [`SC-${pad(st.i, 6)}-${k}`, st.pv, f.name, f.country, f.role, lead, 'FOB', `${f.name} (${f.role}) · ${st.name}`, `${f.role} · ${lead} days`, facThumb(f.country, k > 0)]; } } } },
    bompart: { cols: ['bompartid', 'productversionid', 'sourceversionid', 'part_name', 'section', 'label', 'metric', 'thumb'],
      rows: function* () {
        for (const st of styles()) { const ps = parts(st); for (let k = 0; k < ps.length; k++) { const p = ps[k], first = line(st, p.start, p.name);
          yield [`BP-${pad(st.i, 6)}-${k}`, st.pv, `SC-${pad(st.i, 6)}-0`, p.name, p.group, `${p.name} · ${st.styleNumber}`, `${p.group} · ${p.n} lines`,
            tBadge(tGarment(st.sil, COLORS[colorIdx(st, 0)][1]), tTex(mat[first.m].tex, GREIGE))]; } } } },
    bomlink: { cols: ['bomlinkid', 'bompartid', 'materialversionid', 'supplierversionid', 'colorid', 'placement', 'consumption', 'uom', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) { const ps = parts(st); for (let k = 0; k < ps.length; k++) { const p = ps[k];
        for (let j = p.start; j < p.start + p.n; j++) { const a = line(st, j, p.name), uom = UOM[p.name] || 'pc', pl = PLACE[p.name];
          const cons = uom === 'm' ? r2(0.2 + rr(st.i, 340 + j) * 1.7) : uom === 'kg' ? r2(0.05 + rr(st.i, 340 + j) * 0.2) : 1 + (h32(st.i, 340 + j) % 4);
          yield [`BL-${pad(st.i, 6)}-${pad(j, 3)}`, `BP-${pad(st.i, 6)}-${k}`, mat[a.m].id, sup[a.s].id, 'CL-' + pad(a.c + 1, 2), pl[h32(st.i, 330 + j) % pl.length], cons, uom,
            `${mat[a.m].name} · ${COLORS[a.c][0]}`, `${st.name} · ${cons} ${uom}`, tTex(mat[a.m].tex, COLORS[a.c][1])]; } } } } },
    costsheet: { cols: ['costsheetid', 'sourceversionid', 'version', 'status', 'material_cost', 'labor', 'overhead', 'fob', 'duty_rate', 'landed', 'currency', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) { const fs = factories(st); for (let k = 0; k < fs.length; k++) { const nv = nVer(st, k);
        for (let v = 0; v < nv; v++) { const last = v === nv - 1, fob = r2(fobBase(st) * fs[k].mult * (last ? 1 : 1.04)), duty = CAT.duty[st.c];
          const matc = r2(fob * 0.55), lab = r2(fob * 0.33), ovh = r2(fob - matc - lab), status = last ? (k ? 'Quoted' : 'Approved') : 'Superseded';
          yield [`CS-${pad(st.i, 6)}-${k}-${v}`, `SC-${pad(st.i, 6)}-${k}`, 'v' + (v + 1), status, matc, lab, ovh, fob, duty, r2(fob * (1 + duty) + 1.2), 'USD',
            `${st.name} · v${v + 1} · ${fs[k].name}`, `FOB $${fob.toFixed(2)} · ${status}`, { k: 'cost', fob, mat: matc, lab, ovh, ver: 'v' + (v + 1), dim: !last }]; } } } } },
    skucostsheet: { cols: ['skucostsheetid', 'skuid', 'seasonversionid', 'sourceversionid', 'fob', 'landed', 'retail_price', 'margin_pct', 'label', 'metric', 'thumb'],
      rows: function* () { for (const st of styles()) { const fs = factories(st), rp = retail(st);
        for (let k = 0; k < st.cw; k++) for (let t = 0; t < nSeasons(st); t++) for (let f = 0; f < fs.length; f++) {
          const s = st.s + t, price = rp + t * 10, fob = skuFob(st, k, f, fs), landed = skuLanded(st, k, f, fs), w = price * 0.5, mg = Math.round(((w - landed) / w) * 1000) / 1000;
          const [cn, hex] = COLORS[colorIdx(st, k)];
          yield [`SCS-${pad(st.i, 6)}-${pad(k, 2)}-${t}-${f}`, `SKU-${pad(st.i, 6)}-${pad(k, 2)}`, SV(s), `SC-${pad(st.i, 6)}-${f}`, fob, landed, price, mg,
            `${st.name}, ${cn} · ${SEASON_CODES[s]} · ${fs[f].name.split(' ')[0]}`, `Margin ${(mg * 100).toFixed(1)}%`, tBadge(tGarment(st.sil, hex), facThumb(fs[f].country, f > 0))]; } } } },
  };
  return { styles: STYLES, tables };
}
