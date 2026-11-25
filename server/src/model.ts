/**
 * The product data model, described once and used everywhere: table names, fields,
 * business vocabulary and relationships. The API is generic and driven by this file,
 * so a new table or link is a change here, not a new endpoint.
 */
export type FieldType = 'text' | 'mono' | 'money' | 'pct' | 'num' | 'status' | 'hex' | 'cons' | 'fk';
export interface Field { key: string; label: string; type: FieldType; ref?: string }
export interface Entity {
  name: string;            // technical name, as in the data model diagram
  table: string;           // Postgres table
  pk: string;
  group: 'plan' | 'product' | 'sourcing' | 'material';
  plural: string;          // business vocabulary
  singular: string;
  description: string;
  fields: Field[];
}
export interface Relation { parent: string; child: string; keys: string[]; contains: string; partOf: string }

const f = (key: string, label: string, type: FieldType = 'text', ref?: string): Field => ({ key, label, type, ref });

export const ENTITIES: Entity[] = [
  { name: 'Season', table: 'season', pk: 'seasonversionid', group: 'plan', plural: 'Seasons', singular: 'Season',
    description: 'When styles go to market',
    fields: [f('code', 'Code', 'mono'), f('name', 'Name'), f('year', 'Year', 'num'), f('status', 'Status', 'status')] },
  { name: 'Product', table: 'product', pk: 'productversionid', group: 'product', plural: 'Styles', singular: 'Style',
    description: 'Every garment in the range',
    fields: [f('style_number', 'Style number', 'mono'), f('category', 'Category'), f('gender', 'Gender'), f('status', 'Status', 'status')] },
  { name: 'Sku', table: 'sku', pk: 'skuid', group: 'product', plural: 'Colorways', singular: 'Colorway',
    description: 'Each style in each color (SKU)',
    fields: [f('productversionid', 'Style', 'fk', 'Product'), f('colorway', 'Colorway'), f('size_range', 'Size range')] },
  { name: 'Productseason', table: 'productseason', pk: 'productseasonid', group: 'plan', plural: 'Styles in a season', singular: 'Style in season',
    description: 'Which styles are planned in which season',
    fields: [f('productversionid', 'Style', 'fk', 'Product'), f('seasonversionid', 'Season', 'fk', 'Season'), f('lifecycle', 'Lifecycle', 'status'), f('planned_units', 'Planned units', 'num')] },
  { name: 'Skuseason', table: 'skuseason', pk: 'skuseasonid', group: 'plan', plural: 'Colorways in a season', singular: 'Colorway in season',
    description: 'Seasonal status and retail price per colorway',
    fields: [f('skuid', 'Colorway', 'fk', 'Sku'), f('seasonversionid', 'Season', 'fk', 'Season'), f('status', 'Status', 'status'), f('retail_price', 'Retail price', 'money')] },
  { name: 'Sourcingconfiguration', table: 'sourcingconfiguration', pk: 'sourceversionid', group: 'sourcing', plural: 'Factory sourcing', singular: 'Factory sourcing',
    description: 'Which factory makes each style',
    fields: [f('productversionid', 'Style', 'fk', 'Product'), f('factory', 'Factory'), f('country', 'Country'), f('role', 'Role', 'status'), f('lead_time_days', 'Lead time (days)', 'num'), f('incoterm', 'Incoterm')] },
  { name: 'BOMPart', table: 'bompart', pk: 'bompartid', group: 'material', plural: 'BOM sections', singular: 'BOM section',
    description: 'Body fabric, lining, trims, labels…',
    fields: [f('productversionid', 'Style', 'fk', 'Product'), f('sourceversionid', 'Factory sourcing', 'fk', 'Sourcingconfiguration'), f('part_name', 'Part'), f('section', 'Section')] },
  { name: 'Bomlink', table: 'bomlink', pk: 'bomlinkid', group: 'material', plural: 'BOM lines', singular: 'BOM line',
    description: 'Each material, color and quantity used',
    fields: [f('bompartid', 'BOM section', 'fk', 'BOMPart'), f('materialversionid', 'Material', 'fk', 'Material'), f('supplierversionid', 'Supplier', 'fk', 'Supplier'),
      f('colorid', 'Color', 'fk', 'Color'), f('placement', 'Placement'), f('consumption', 'Consumption', 'cons')] },
  { name: 'Costsheet', table: 'costsheet', pk: 'costsheetid', group: 'sourcing', plural: 'Cost sheets', singular: 'Cost sheet',
    description: 'FOB build-up per factory and version',
    fields: [f('sourceversionid', 'Factory sourcing', 'fk', 'Sourcingconfiguration'), f('version', 'Version', 'mono'), f('status', 'Status', 'status'),
      f('material_cost', 'Material cost', 'money'), f('labor', 'Labor (CMT)', 'money'), f('overhead', 'Overhead', 'money'), f('fob', 'FOB', 'money'),
      f('duty_rate', 'Duty rate', 'pct'), f('landed', 'Landed cost', 'money')] },
  { name: 'Skucostsheet', table: 'skucostsheet', pk: 'skucostsheetid', group: 'sourcing', plural: 'Colorway costs', singular: 'Colorway cost',
    description: 'Landed cost and margin per colorway',
    fields: [f('skuid', 'Colorway', 'fk', 'Sku'), f('seasonversionid', 'Season', 'fk', 'Season'), f('sourceversionid', 'Factory sourcing', 'fk', 'Sourcingconfiguration'),
      f('fob', 'FOB', 'money'), f('landed', 'Landed cost', 'money'), f('retail_price', 'Retail price', 'money'), f('margin_pct', 'Wholesale margin', 'pct')] },
  { name: 'Supplier', table: 'supplier', pk: 'supplierversionid', group: 'material', plural: 'Suppliers', singular: 'Supplier',
    description: 'Mills and trim vendors',
    fields: [f('country', 'Country'), f('supplier_type', 'Type'), f('rating', 'Rating')] },
  { name: 'Material', table: 'material', pk: 'materialversionid', group: 'material', plural: 'Materials', singular: 'Material',
    description: 'Fabrics, insulation, trims and labels',
    fields: [f('material_code', 'Material code', 'mono'), f('material_type', 'Type'), f('composition', 'Composition'), f('weight', 'Weight')] },
  { name: 'Color', table: 'color', pk: 'colorid', group: 'material', plural: 'Colors', singular: 'Color',
    description: 'The approved color palette',
    fields: [f('color_code', 'Color code', 'mono'), f('hex', 'Swatch', 'hex'), f('color_family', 'Family', 'mono')] },
  { name: 'Materialsupplier', table: 'materialsupplier', pk: 'materialsupplierid', group: 'material', plural: 'Material prices', singular: 'Material price',
    description: 'What each supplier charges for a material',
    fields: [f('materialversionid', 'Material', 'fk', 'Material'), f('supplierversionid', 'Supplier', 'fk', 'Supplier'), f('unit_price', 'Unit price', 'money'),
      f('uom', 'UOM'), f('moq', 'MOQ', 'num'), f('lead_time_days', 'Lead time (days)', 'num')] },
  { name: 'Materialcolor', table: 'materialcolor', pk: 'materialcolorid', group: 'material', plural: 'Material colors', singular: 'Material color',
    description: 'Lab-dip status of each material in each color',
    fields: [f('materialversionid', 'Material', 'fk', 'Material'), f('supplierversionid', 'Supplier', 'fk', 'Supplier'), f('colorid', 'Color', 'fk', 'Color'), f('lab_dip_status', 'Lab dip', 'status')] },
];

/** Relationships exactly as drawn in the data model diagram: parent → child via key(s). */
export const RELATIONS: Relation[] = [
  { parent: 'Season', child: 'Productseason', keys: ['seasonversionid'], contains: 'Styles in this season', partOf: 'Season' },
  { parent: 'Season', child: 'Skuseason', keys: ['seasonversionid'], contains: 'Colorways in this season', partOf: 'Season' },
  { parent: 'Product', child: 'Productseason', keys: ['productversionid'], contains: 'Seasons', partOf: 'Style' },
  { parent: 'Product', child: 'Sku', keys: ['productversionid'], contains: 'Colorways', partOf: 'Style' },
  { parent: 'Product', child: 'BOMPart', keys: ['productversionid'], contains: 'Bill of materials', partOf: 'Style' },
  { parent: 'Product', child: 'Sourcingconfiguration', keys: ['productversionid'], contains: 'Factories', partOf: 'Style' },
  { parent: 'Sku', child: 'Skuseason', keys: ['skuid'], contains: 'Seasons', partOf: 'Colorway' },
  { parent: 'Sku', child: 'Skucostsheet', keys: ['skuid'], contains: 'Costs', partOf: 'Colorway' },
  { parent: 'Sourcingconfiguration', child: 'BOMPart', keys: ['sourceversionid'], contains: 'BOM sections', partOf: 'Factory sourcing' },
  { parent: 'Sourcingconfiguration', child: 'Costsheet', keys: ['sourceversionid'], contains: 'Cost sheets', partOf: 'Factory sourcing' },
  { parent: 'Sourcingconfiguration', child: 'Skucostsheet', keys: ['sourceversionid'], contains: 'Colorway costs', partOf: 'Factory sourcing' },
  { parent: 'Skuseason', child: 'Skucostsheet', keys: ['skuid', 'seasonversionid'], contains: 'Costs this season', partOf: 'Colorway in season' },
  { parent: 'BOMPart', child: 'Bomlink', keys: ['bompartid'], contains: 'BOM lines', partOf: 'BOM section' },
  { parent: 'Supplier', child: 'Bomlink', keys: ['supplierversionid'], contains: 'Used in BOM lines', partOf: 'Supplier' },
  { parent: 'Material', child: 'Bomlink', keys: ['materialversionid'], contains: 'Used in BOM lines', partOf: 'Material' },
  { parent: 'Color', child: 'Bomlink', keys: ['colorid'], contains: 'Used in BOM lines', partOf: 'Color' },
  { parent: 'Supplier', child: 'Materialsupplier', keys: ['supplierversionid'], contains: 'Materials and prices', partOf: 'Supplier' },
  { parent: 'Material', child: 'Materialsupplier', keys: ['materialversionid'], contains: 'Suppliers and prices', partOf: 'Material' },
  { parent: 'Material', child: 'Materialcolor', keys: ['materialversionid'], contains: 'Available colors', partOf: 'Material' },
  { parent: 'Supplier', child: 'Materialcolor', keys: ['supplierversionid'], contains: 'Material colors offered', partOf: 'Supplier' },
  { parent: 'Color', child: 'Materialcolor', keys: ['colorid'], contains: 'Materials in this color', partOf: 'Color' },
];

export const SEASON_CODES = ['SS25', 'FW25', 'SS26', 'FW26', 'SS27'];

const byName = new Map(ENTITIES.map((e) => [e.name.toLowerCase(), e]));
export function entity(name: string): Entity | undefined { return byName.get(String(name).toLowerCase()); }
export const relKey = (r: Relation) => `${r.parent}>${r.child}`;
