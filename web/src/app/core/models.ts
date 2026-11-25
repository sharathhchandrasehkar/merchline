export type FieldType = 'text' | 'mono' | 'money' | 'pct' | 'num' | 'status' | 'hex' | 'cons' | 'fk';
export interface Field { key: string; label: string; type: FieldType; ref?: string }
export interface Entity {
  name: string; table: string; pk: string; group: 'plan' | 'product' | 'sourcing' | 'material';
  plural: string; singular: string; description: string; fields: Field[];
}
export interface Relation { key: string; parent: string; child: string; keys: string[]; contains: string; partOf: string }
export interface Meta { entities: Entity[]; relations: Relation[]; seasons: string[]; traceStarts: string[]; ai: boolean }
export type Thumb = Record<string, any> | null;
export interface Item { entity: string; id: string; label: string; metric: string | null; thumb: Thumb }
export interface Page<T> { total: number; items: T[] }
export interface Group { key: string; dir: 'up' | 'down'; entity: string; keys: string[]; title: string; total: number; items: Item[] }
export interface RecordView { entity: string; id: string; row: Record<string, any>; refs: Record<string, Item>; groups: Group[] }
export interface TraceRows { groups: string[]; joins: { entity: string; on: string }[]; rows: Record<string, Record<string, any>>[] }
export interface TraceSummary { paths: number; styles: number; bySeason: Record<string, number> }
export interface Overview {
  counts: Record<string, number>; categories: string[]; seasons: string[];
  matrix: { styles: (number | null)[][]; colorways: (number | null)[][]; margin: (number | null)[][] };
  watch: { id: string; label: string; metric: string; thumb: Thumb; category: string; margin: number; colorways: number }[];
}
export interface AskResult { engine: 'claude' | 'rules'; start: string; q: string; seasons: string[]; explanation: string }
export interface Health { ok: boolean; seeded: boolean; seeding: boolean; styles: number; message: string; ai: boolean }
