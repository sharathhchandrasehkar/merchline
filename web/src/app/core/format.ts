export const money = (v: number | null | undefined) => (v == null ? '—' : Math.abs(v) >= 1000 ? '$' + Math.round(v).toLocaleString('en-US') : '$' + v.toFixed(2));
export const pct = (v: number | null | undefined) => (v == null ? '—' : (v * 100).toFixed(1) + '%');
export const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('en-US'));
export const compact = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M' : n >= 1e4 ? Math.round(n / 1000) + 'K' : n.toLocaleString('en-US'));
const GOOD = new Set(['Approved', 'Active', 'In Market', 'Primary', 'New']);
const WARN = new Set(['Costing', 'In Development', 'In development', 'Quoted', 'Pending', 'Alternate', 'Concept']);
export const tone = (v: string) => (GOOD.has(v) ? 'good' : WARN.has(v) ? 'warn' : '');
export const GROUP_COLOR: Record<string, string> = { plan: 'var(--g-plan)', product: 'var(--g-product)', sourcing: 'var(--g-sourcing)', material: 'var(--g-material)' };
