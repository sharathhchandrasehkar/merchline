/**
 * Merchline schema: the 15 tables of the product data model.
 * Every table also stores label (display name, used for search), metric (a one-line summary)
 * and thumb (a small JSON recipe the frontend turns into an SVG thumbnail).
 */
export const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS season (
  seasonversionid text PRIMARY KEY, code text NOT NULL, name text NOT NULL, year int NOT NULL, status text NOT NULL,
  label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS color (
  colorid text PRIMARY KEY, color_code text NOT NULL, name text NOT NULL, hex text NOT NULL, color_family text NOT NULL,
  label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS supplier (
  supplierversionid text PRIMARY KEY, name text NOT NULL, country text NOT NULL, supplier_type text NOT NULL, rating text NOT NULL,
  label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS material (
  materialversionid text PRIMARY KEY, material_code text NOT NULL, name text NOT NULL, material_type text NOT NULL,
  composition text NOT NULL, weight text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS materialsupplier (
  materialsupplierid text PRIMARY KEY,
  materialversionid text NOT NULL REFERENCES material, supplierversionid text NOT NULL REFERENCES supplier,
  unit_price numeric(10,2) NOT NULL, uom text NOT NULL, currency text NOT NULL, moq int NOT NULL, lead_time_days int NOT NULL,
  label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS materialcolor (
  materialcolorid text PRIMARY KEY,
  materialversionid text NOT NULL REFERENCES material, supplierversionid text NOT NULL REFERENCES supplier, colorid text NOT NULL REFERENCES color,
  lab_dip_status text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS product (
  productversionid text PRIMARY KEY, style_number text NOT NULL, name text NOT NULL, category text NOT NULL,
  gender text NOT NULL, status text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS sku (
  skuid text PRIMARY KEY, productversionid text NOT NULL REFERENCES product, sku_name text NOT NULL, colorway text NOT NULL,
  colorid text REFERENCES color, size_range text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS productseason (
  productseasonid text PRIMARY KEY, productversionid text NOT NULL REFERENCES product, seasonversionid text NOT NULL REFERENCES season,
  lifecycle text NOT NULL, planned_units int NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS skuseason (
  skuseasonid text PRIMARY KEY, skuid text NOT NULL REFERENCES sku, seasonversionid text NOT NULL REFERENCES season,
  status text NOT NULL, retail_price numeric(10,2) NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS sourcingconfiguration (
  sourceversionid text PRIMARY KEY, productversionid text NOT NULL REFERENCES product, factory text NOT NULL, country text NOT NULL,
  role text NOT NULL, lead_time_days int NOT NULL, incoterm text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS bompart (
  bompartid text PRIMARY KEY, productversionid text NOT NULL REFERENCES product, sourceversionid text NOT NULL REFERENCES sourcingconfiguration,
  part_name text NOT NULL, section text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS bomlink (
  bomlinkid text PRIMARY KEY, bompartid text NOT NULL REFERENCES bompart, materialversionid text NOT NULL REFERENCES material,
  supplierversionid text NOT NULL REFERENCES supplier, colorid text NOT NULL REFERENCES color, placement text NOT NULL,
  consumption numeric(10,2) NOT NULL, uom text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS costsheet (
  costsheetid text PRIMARY KEY, sourceversionid text NOT NULL REFERENCES sourcingconfiguration, version text NOT NULL, status text NOT NULL,
  material_cost numeric(10,2) NOT NULL, labor numeric(10,2) NOT NULL, overhead numeric(10,2) NOT NULL, fob numeric(10,2) NOT NULL,
  duty_rate numeric(6,4) NOT NULL, landed numeric(10,2) NOT NULL, currency text NOT NULL, label text NOT NULL, metric text, thumb jsonb);

CREATE TABLE IF NOT EXISTS skucostsheet (
  skucostsheetid text PRIMARY KEY, skuid text NOT NULL REFERENCES sku, seasonversionid text NOT NULL REFERENCES season,
  sourceversionid text NOT NULL REFERENCES sourcingconfiguration, fob numeric(10,2) NOT NULL, landed numeric(10,2) NOT NULL,
  retail_price numeric(10,2) NOT NULL, margin_pct numeric(6,4) NOT NULL, label text NOT NULL, metric text, thumb jsonb);
`;

/** Indexes are created after the bulk load, which is much faster than loading into indexed tables. */
export const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS ix_ms_mat ON materialsupplier (materialversionid);
CREATE INDEX IF NOT EXISTS ix_ms_sup ON materialsupplier (supplierversionid);
CREATE INDEX IF NOT EXISTS ix_mc_mat ON materialcolor (materialversionid);
CREATE INDEX IF NOT EXISTS ix_mc_sup ON materialcolor (supplierversionid);
CREATE INDEX IF NOT EXISTS ix_mc_col ON materialcolor (colorid);
CREATE INDEX IF NOT EXISTS ix_sku_prod ON sku (productversionid);
CREATE INDEX IF NOT EXISTS ix_ps_prod ON productseason (productversionid);
CREATE INDEX IF NOT EXISTS ix_ps_season ON productseason (seasonversionid);
CREATE INDEX IF NOT EXISTS ix_ss_sku ON skuseason (skuid);
CREATE INDEX IF NOT EXISTS ix_ss_season ON skuseason (seasonversionid);
CREATE INDEX IF NOT EXISTS ix_sc_prod ON sourcingconfiguration (productversionid);
CREATE INDEX IF NOT EXISTS ix_bp_prod ON bompart (productversionid);
CREATE INDEX IF NOT EXISTS ix_bp_sc ON bompart (sourceversionid);
CREATE INDEX IF NOT EXISTS ix_bl_bp ON bomlink (bompartid);
CREATE INDEX IF NOT EXISTS ix_bl_mat ON bomlink (materialversionid);
CREATE INDEX IF NOT EXISTS ix_bl_sup ON bomlink (supplierversionid);
CREATE INDEX IF NOT EXISTS ix_bl_col ON bomlink (colorid);
CREATE INDEX IF NOT EXISTS ix_bl_msc ON bomlink (materialversionid, supplierversionid, colorid);
CREATE INDEX IF NOT EXISTS ix_cs_sc ON costsheet (sourceversionid);
CREATE INDEX IF NOT EXISTS ix_scs_sku ON skucostsheet (skuid);
CREATE INDEX IF NOT EXISTS ix_scs_season ON skucostsheet (seasonversionid);
CREATE INDEX IF NOT EXISTS ix_scs_sc ON skucostsheet (sourceversionid);
CREATE INDEX IF NOT EXISTS ix_scs_sku_season ON skucostsheet (skuid, seasonversionid);
CREATE INDEX IF NOT EXISTS ix_product_label_trgm ON product USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_material_label_trgm ON material USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_supplier_label_trgm ON supplier USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_mc_label_trgm ON materialcolor USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_sku_label_trgm ON sku USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_cs_label_trgm ON costsheet USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_scs_label_trgm ON skucostsheet USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_bl_label_trgm ON bomlink USING gin (label gin_trgm_ops);
ANALYZE;
`;

/** Tables in load order (parents before children). */
export const LOAD_ORDER = ['season', 'color', 'supplier', 'material', 'materialsupplier', 'materialcolor', 'product', 'sku',
  'productseason', 'skuseason', 'sourcingconfiguration', 'bompart', 'bomlink', 'costsheet', 'skucostsheet'];
