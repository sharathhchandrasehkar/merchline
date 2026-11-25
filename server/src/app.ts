import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ENTITIES, RELATIONS, SEASON_CODES, entity, relKey } from './model.js';
import { aiEnabled, ask } from './lib/ask.js';
import { getRecord, listEntity, relatedGroups, relatedPage, searchAll } from './lib/records.js';
import { overview } from './lib/stats.js';
import { TRACE_STARTS, traceRows, traceSummary } from './lib/trace.js';
import { status } from './status.js';

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).then((data) => { if (!res.headersSent) res.json(data); }).catch(next);
const int = (v: unknown, def: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Math.floor(Number(v)) : def));
const str = (v: unknown) => (typeof v === 'string' ? v : '');
function need(name: string) {
  const e = entity(name);
  if (!e) throw Object.assign(new Error(`Unknown table: ${name}`), { status: 404 });
  return e;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
  app.use(compression());
  app.use(express.json({ limit: '20kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => { res.json({ ok: true, ...status, ai: aiEnabled() }); });

  // until the first seed finishes, data routes answer 503 with a friendly message
  api.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/meta' || status.seeded) return next();
    res.status(503).json({ error: status.seeding ? 'The demo catalog is being generated. Try again in a minute.' : 'The database is not ready yet.', ...status });
  });

  api.get('/meta', (_req, res) => {
    res.json({ entities: ENTITIES, relations: RELATIONS.map((r) => ({ ...r, key: relKey(r) })), seasons: SEASON_CODES, traceStarts: TRACE_STARTS, ai: aiEnabled() });
  });
  api.get('/overview', wrap(() => overview()));
  api.get('/search', wrap((req) => searchAll(str(req.query.q))));

  api.get('/entities/:entity', wrap((req) => {
    const e = need(String(req.params.entity));
    return listEntity(e, str(req.query.q), int(req.query.offset, 0, 1e7), int(req.query.limit, 48, 200));
  }));
  api.get('/entities/:entity/:id', wrap(async (req, res) => {
    const e = need(String(req.params.entity));
    const rec = await getRecord(e, String(req.params.id));
    if (!rec) { res.status(404).json({ error: `${e.singular} ${req.params.id} not found` }); return; }
    return { ...rec, groups: await relatedGroups(e, rec.row, int(req.query.first, 6, 50)) };
  }));
  api.get('/entities/:entity/:id/related/:rel', wrap(async (req, res) => {
    const e = need(String(req.params.entity));
    const r = RELATIONS.find((x) => relKey(x) === req.params.rel && x.parent === e.name);
    if (!r) { res.status(404).json({ error: 'Unknown relationship' }); return; }
    const rec = await getRecord(e, String(req.params.id));
    if (!rec) { res.status(404).json({ error: 'Record not found' }); return; }
    return relatedPage(r.child, r.keys, rec.row, int(req.query.offset, 0, 1e7), int(req.query.limit, 24, 200));
  }));

  const TraceQuery = z.object({
    start: z.enum(TRACE_STARTS as [string, ...string[]]),
    q: z.string().max(100).optional(),
    id: z.string().max(60).optional(),
    seasons: z.string().optional().transform((s) => (s ? s.split(',').filter(Boolean) : [])),
  });
  api.get('/trace', wrap((req) => {
    const a = TraceQuery.parse(req.query);
    return traceRows(a, int(req.query.offset, 0, 1e6), int(req.query.limit, 100, 500));
  }));
  api.get('/trace/summary', wrap((req) => traceSummary(TraceQuery.parse(req.query))));

  api.post('/ask', wrap((req) => {
    const { question } = z.object({ question: z.string().min(3).max(300) }).parse(req.body);
    return ask(question);
  }));

  app.use('/api', api);

  // optional: serve the built Angular app from the same service (single-service deployments)
  const web = process.env.WEB_DIST && path.resolve(process.env.WEB_DIST);
  if (web && existsSync(path.join(web, 'index.html'))) {
    app.use(express.static(web, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(web, 'index.html')));
  }

  app.use((err: Error & { status?: number; issues?: unknown }, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid request', issues: err.issues }); return; }
    const code = err.status || 500;
    if (code >= 500) console.error(err);
    res.status(code).json({ error: code >= 500 ? 'Something went wrong on the server.' : err.message });
  });
  return app;
}
