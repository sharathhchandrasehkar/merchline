/**
 * API integration tests. They need a disposable Postgres in DATABASE_URL (CI starts one;
 * locally use `npm run db:local`). The database is wiped and seeded with 200 styles.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { resetCaches } from '../src/lib/records.js';
import { resetOverview } from '../src/lib/stats.js';
import { TRACE_STARTS } from '../src/lib/trace.js';
import { seed } from '../src/seed/load.js';
import { status } from '../src/status.js';

const app = createApp();

before(async () => {
  await seed(200, () => {});
  resetCaches(); resetOverview();
  status.seeded = true;
});
after(() => pool.end());

describe('catalog', () => {
  it('reports health and the data model', async () => {
    const h = await request(app).get('/api/health').expect(200);
    assert.equal(h.body.ok, true);
    const m = await request(app).get('/api/meta').expect(200);
    assert.equal(m.body.entities.length, 15);
    assert.equal(m.body.relations.length, 21);
  });

  it('lists and searches a table', async () => {
    const all = await request(app).get('/api/entities/Product?limit=5').expect(200);
    assert.equal(all.body.total, 200);
    assert.equal(all.body.items.length, 5);
    const name = all.body.items[0].label.split(' ')[0];
    const found = await request(app).get(`/api/entities/Product?q=${encodeURIComponent(name)}`).expect(200);
    assert.ok(found.body.total >= 1);
    assert.ok(found.body.items.every((i: { label: string }) => i.label.includes(name)));
  });

  it('opens a record with every relationship', async () => {
    const r = await request(app).get('/api/entities/Product/PV-000001').expect(200);
    assert.equal(r.body.row.productversionid, 'PV-000001');
    const titles = r.body.groups.map((g: { title: string }) => g.title);
    assert.deepEqual(titles.sort(), ['Bill of materials', 'Colorways', 'Factories', 'Seasons']);
    const cw = r.body.groups.find((g: { title: string }) => g.title === 'Colorways');
    assert.equal(cw.items.length, Math.min(cw.total, 6));
  });

  it('resolves parents from a child record', async () => {
    const r = await request(app).get('/api/entities/Skucostsheet/SCS-000001-00-0-0').expect(200);
    const up = r.body.groups.filter((g: { dir: string }) => g.dir === 'up').map((g: { entity: string; total: number }) => [g.entity, g.total]);
    assert.deepEqual(up.sort(), [['Sku', 1], ['Skuseason', 1], ['Sourcingconfiguration', 1]]);
  });

  it('pages a large relationship', async () => {
    const m = await request(app).get('/api/entities/Material?limit=1').expect(200);
    const id = m.body.items[0].id;
    const p1 = await request(app).get(`/api/entities/Material/${id}/related/Material>Bomlink?limit=3`).expect(200);
    const p2 = await request(app).get(`/api/entities/Material/${id}/related/Material>Bomlink?limit=3&offset=3`).expect(200);
    if (p1.body.total > 3) assert.notEqual(p1.body.items[0].id, p2.body.items[0].id);
  });

  it('returns 404 for unknown tables and records', async () => {
    await request(app).get('/api/entities/Nope').expect(404);
    await request(app).get('/api/entities/Product/PV-999999').expect(404);
  });
});

describe('trace to season', () => {
  for (const start of TRACE_STARTS) {
    it(`traces ${start} all the way to Season`, async () => {
      const r = await request(app).get(`/api/trace?start=${start}&limit=5`).expect(200);
      assert.equal(r.body.groups[0], start);
      assert.equal(r.body.groups.at(-1), 'Season');
      assert.ok(r.body.rows.length > 0);
      for (const row of r.body.rows) assert.match(row.Season.code, /^(SS|FW)\d{2}$/);
    });
  }

  it('filters by name and season, and the summary adds up', async () => {
    const q = 'start=Material&q=Ripstop&seasons=FW26,SS26';
    const s = await request(app).get(`/api/trace/summary?${q}`).expect(200);
    const sum = Object.values(s.body.bySeason as Record<string, number>).reduce((a, b) => a + b, 0);
    assert.equal(sum, s.body.paths);
    assert.ok(Object.keys(s.body.bySeason).every((k) => k === 'FW26' || k === 'SS26'));
    const r = await request(app).get(`/api/trace?${q}&limit=20`).expect(200);
    for (const row of r.body.rows) {
      assert.match(row.Material.name, /Ripstop/);
      assert.ok(['FW26', 'SS26'].includes(row.Season.code));
    }
  });

  it('rejects an unknown start table', async () => {
    await request(app).get('/api/trace?start=Nope').expect(400);
  });
});

describe('overview and ask', () => {
  it('builds the category × season matrix', async () => {
    const o = await request(app).get('/api/overview').expect(200);
    assert.equal(o.body.matrix.styles.length, 5);
    const total = o.body.matrix.styles.flat().reduce((a: number, b: number | null) => a + (b || 0), 0);
    assert.equal(total, o.body.counts.Productseason);
  });

  it('turns a question into a trace without an API key', async () => {
    const saved = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    const r = await request(app).post('/api/ask').send({ question: 'Which FW26 styles use ripstop?' }).expect(200);
    assert.equal(r.body.engine, 'rules');
    assert.equal(r.body.start, 'Material');
    assert.equal(r.body.q, 'ripstop');
    assert.deepEqual(r.body.seasons, ['FW26']);
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});
