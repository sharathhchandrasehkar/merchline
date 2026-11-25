/**
 * Turns the API's thumbnail recipes into small SVG drawings: garment silhouettes in their colorway,
 * fabric textures tinted by color, swatches, season tiles, supplier monograms, factories and cost bars.
 * Every value is checked before it reaches the SVG string, so only known shapes and #hex colors are drawn.
 */
import type { Thumb } from '../core/models';

let uid = 0;
const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v: unknown, d = '#9aa3b2') => (typeof v === 'string' && HEX.test(v) ? v : d);
const safe = (v: unknown, max = 6) => String(v ?? '').replace(/[^A-Za-z0-9 .$-]/g, '').slice(0, max);
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const shade = (h: string, a: number) => 'rgb(' + rgb(h).map((v) => Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a)).join(',') + ')';
const lum = (h: string) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const detail = (h: string) => (lum(h) < 0.45 ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.28)');
const BG = '<rect class="tb" width="100" height="100"/>';

const SIL: Record<string, [string, string]> = {
  jacket: ['M37 20 Q50 8 63 20 L76 25 L88 62 L79 66 L70 46 L70 90 L30 90 L30 46 L21 66 L12 62 L24 25 Z', 'M50 24 V90 M38 21 Q50 31 62 21 M34 68 L44 66 M66 68 L56 66 M30 85 H70'],
  tee: ['M36 16 Q50 26 64 16 L86 28 L79 44 L70 40 L70 88 L30 88 L30 40 L21 44 L14 28 Z', 'M39 17 Q50 25 61 17 M30 82 H70 M21 38 L30 34 M79 38 L70 34'],
  pant: ['M29 10 H71 L77 90 H56 L50 38 L44 90 H23 Z', 'M29 18 H71 M50 18 V38 M28 52 H39 V64 H28 Z M61 52 H72 V64 H61 Z'],
  vest: ['M36 13 Q50 22 64 13 L73 17 Q66 31 73 42 V90 H27 V42 Q34 31 27 17 Z', 'M50 21 V90 M29 41 H71 M27 53 H73 M27 65 H73 M27 77 H73'],
  hoodie: ['M37 20 Q50 6 63 20 L76 26 L87 64 L78 68 L70 48 L70 90 L30 90 L30 48 L22 68 L13 64 L24 26 Z', 'M38 21 Q50 31 62 21 M46 27 V38 M54 27 V38 M37 64 H63 L67 80 H33 Z M30 85 H70'],
};

function garment(t: Record<string, any>) {
  const hex = hexOr(t['hex']), [m, d] = SIL[t['sil']] || SIL['tee'];
  const dots = Array.isArray(t['dots']) ? t['dots'].slice(0, 4).map((c: unknown, i: number) =>
    `<circle cx="${12 + i * 10}" cy="12" r="4" fill="${hexOr(c)}" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>`).join('') : '';
  return `${BG}<path d="${m}" fill="${hex}" stroke="${shade(hex, lum(hex) < 0.2 ? 0.35 : -0.35)}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${detail(hex)}" stroke-width="1.3" stroke-linejoin="round"/>${dots}`;
}

function tex(t: Record<string, any>) {
  const hex = hexOr(t['hex']), kind = String(t['tex']), id = 'tp' + uid++, d = detail(hex), st = shade(hex, lum(hex) < 0.2 ? 0.3 : -0.3);
  const pats: Record<string, string> = {
    ripstop: `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 .6H9M.6 0V9" stroke="${d}" stroke-width="1"/></pattern>`,
    knit: `<pattern id="${id}" width="6" height="5" patternUnits="userSpaceOnUse"><path d="M0 0 L3 4 L6 0" fill="none" stroke="${d}" stroke-width=".9"/></pattern>`,
    twill: `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0V5" stroke="${d}" stroke-width="1.5"/></pattern>`,
    down: `<pattern id="${id}" width="100" height="15" patternUnits="userSpaceOnUse"><rect y="2" width="100" height="7" fill="rgba(255,255,255,.14)"/><path d="M0 14.3H100" stroke="${d}" stroke-width="1.4"/></pattern>`,
    fleece: `<pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${d}"/><circle cx="5.5" cy="5" r=".8" fill="${d}"/></pattern>`,
    mesh: `<pattern id="${id}" width="8" height="7" patternUnits="userSpaceOnUse"><circle cx="4" cy="3.5" r="2.2" fill="none" stroke="${d}" stroke-width="1"/></pattern>`,
  };
  if (pats[kind]) {
    const sh = 'M14 12 H86 V72 L72 88 H14 Z';
    return `${BG}<defs>${pats[kind]}</defs><path d="${sh}" fill="${hex}" stroke="${st}" stroke-width="1.2"/><path d="${sh}" fill="url(#${id})"/>` +
      `<path d="M86 72 L72 72 L72 88 Z" fill="${shade(hex, lum(hex) < 0.2 ? 0.25 : -0.18)}" stroke="${st}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  if (kind === 'zipper') {
    let teeth = ''; for (let y = 36; y < 88; y += 4.2) teeth += `<rect x="${y % 8.4 < 4 ? 45 : 50}" y="${y}" width="5" height="2.6" rx=".8" fill="${shade(hex, lum(hex) < 0.2 ? 0.3 : -0.25)}"/>`;
    return `${BG}<rect x="28" y="10" width="44" height="82" rx="2" fill="${hex}" stroke="${st}"/>${teeth}<rect x="41" y="18" width="18" height="18" rx="4" fill="#8f96a0" stroke="#5e646d"/><rect x="46" y="32" width="8" height="18" rx="3" fill="#a8aeb6" stroke="#5e646d"/>`;
  }
  if (kind === 'cordlock') {
    return `${BG}<path d="M50 4 V30 M50 70 V96" stroke="#cfc6b4" stroke-width="4" stroke-linecap="round"/><rect x="34" y="26" width="32" height="48" rx="14" fill="${hex}" stroke="${st}" stroke-width="1.3"/>` +
      `<ellipse cx="50" cy="50" rx="7" ry="9" fill="${shade(hex, lum(hex) < 0.2 ? 0.25 : -0.3)}"/><path d="M38 40 H62 M38 60 H62" stroke="${d}" stroke-width="1.2"/>`;
  }
  return `${BG}<rect x="14" y="32" width="72" height="36" rx="2" fill="${hex}" stroke="${st}"/><path d="M14 32 L22 50 L14 68 M86 32 L78 50 L86 68" fill="none" stroke="${d}" stroke-width="1"/>` +
    `<rect x="34" y="42" width="32" height="5" rx="1" fill="${d}"/><rect x="38" y="52" width="24" height="3" rx="1" fill="${d}"/>`;
}

function season(t: Record<string, any>) {
  const code = safe(t['code'], 4), ss = code.startsWith('SS');
  const bg = ({ SS25: '#e9d9a6', FW25: '#6b7f96', SS26: '#f2c75c', FW26: '#3f5b7d', SS27: '#9dd1a8' } as Record<string, string>)[code] || '#cccccc';
  const motif = ss ? '<circle cx="72" cy="30" r="13" fill="rgba(255,255,255,.55)"/>' : '<path d="M72 16 V44 M60 23 L84 37 M60 37 L84 23" stroke="rgba(255,255,255,.6)" stroke-width="3" stroke-linecap="round"/>';
  return `<rect width="100" height="100" fill="${bg}"/>${motif}<text x="12" y="84" font-size="30" font-weight="600" class="tdisp" fill="${ss ? '#1d1d1f' : '#ffffff'}">${code}</text>`;
}
const swatch = (t: Record<string, any>) => { const h = hexOr(t['hex']); return `${BG}<rect x="14" y="14" width="72" height="72" rx="8" fill="${h}" stroke="${shade(h, lum(h) < 0.2 ? 0.3 : -0.25)}" stroke-width="1.2"/><path d="M22 22 h22" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round"/>`; };
function mono(t: Record<string, any>) {
  const bg = ['#d7e3f6', '#f4e2c4', '#dcefe3', '#eadff3'][Number(t['tone']) || 0] || '#d7e3f6';
  return `<rect width="100" height="100" fill="${bg}"/><text x="50" y="62" text-anchor="middle" font-size="38" font-weight="600" class="tdisp" fill="#1d2b44">${safe(t['text'], 2)}</text>` +
    `<text x="50" y="86" text-anchor="middle" font-size="12" class="tmono" fill="#3d4a60">${safe(t['sub'], 2)}</text>`;
}
function factory(t: Record<string, any>) {
  const alt = !!t['alt'], body = alt ? '#9a8f80' : '#7b6a55';
  return `<rect width="100" height="100" fill="${alt ? '#ece9e4' : '#efe5d6'}"/><path d="M14 80 V50 L30 40 V50 L46 40 V50 L62 40 V50 H86 V80 Z" fill="${body}"/><path d="M70 50 V24 H77 V50" fill="${body}"/>` +
    `<path d="M22 60 h8 v8 h-8z M38 60 h8 v8 h-8z M54 60 h8 v8 h-8z M70 60 h8 v8 h-8z" fill="rgba(255,255,255,.5)"/><text x="12" y="24" font-size="13" class="tmono" fill="#4a3d2c">${safe(t['iso'], 2)}</text>`;
}
function cost(t: Record<string, any>) {
  const m = +t['mat'] || 0, l = +t['lab'] || 0, o = +t['ovh'] || 0, s = m + l + o || 1, w1 = (72 * m) / s, w2 = (72 * l) / s, w3 = 72 - w1 - w2;
  return `${BG}<g opacity="${t['dim'] ? 0.55 : 1}"><text x="14" y="30" font-size="11" class="tm tmono">FOB ${safe(t['ver'], 3)}</text><text x="14" y="54" font-size="21" class="tt tdisp">$${(+t['fob'] || 0).toFixed(2)}</text>` +
    `<rect x="14" y="66" width="${w1}" height="12" class="c-mat"/><rect x="${14 + w1}" y="66" width="${w2}" height="12" class="c-lab"/><rect x="${14 + w1 + w2}" y="66" width="${w3}" height="12" class="c-ovh"/></g>`;
}
function badge(t: Record<string, any>) {
  const cid = 'tc' + uid++;
  return `${inner(t['main'])}<circle cx="78" cy="78" r="21" class="bring"/><svg x="60" y="60" width="36" height="36" viewBox="0 0 100 100"><defs><clipPath id="${cid}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${cid})">${inner(t['small'])}</g></svg>`;
}
function inner(t: Thumb): string {
  if (!t || typeof t !== 'object') return BG;
  switch (t['k']) {
    case 'garment': return garment(t); case 'tex': return tex(t); case 'season': return season(t); case 'swatch': return swatch(t);
    case 'mono': return mono(t); case 'factory': return factory(t); case 'cost': return cost(t); case 'badge': return badge(t);
    default: return BG;
  }
}
export const thumbSvg = (t: Thumb) => `<svg class="th" viewBox="0 0 100 100" aria-hidden="true">${inner(t)}</svg>`;
