import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { AskResult, Group, Health, Item, Meta, Overview, Page, RecordView, TraceRows, TraceSummary } from './models';

/** Where the API lives. Set at build time in public/env.js (see scripts/write-env.mjs); empty means same origin. */
export const API_BASE: string = ((globalThis as any).__MERCHLINE_API__ || '').replace(/\/$/, '') + '/api';

export interface TraceQuery { start: string; q?: string; id?: string; seasons?: string[] }
function traceParams(t: TraceQuery, extra: Record<string, number> = {}) {
  let p = new HttpParams().set('start', t.start);
  if (t.id) p = p.set('id', t.id); else if (t.q) p = p.set('q', t.q);
  if (t.seasons?.length) p = p.set('seasons', t.seasons.join(','));
  for (const [k, v] of Object.entries(extra)) p = p.set(k, v);
  return p;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  health(): Observable<Health> { return this.http.get<Health>(`${API_BASE}/health`); }
  meta(): Observable<Meta> { return this.http.get<Meta>(`${API_BASE}/meta`); }
  overview(): Observable<Overview> { return this.http.get<Overview>(`${API_BASE}/overview`); }
  search(q: string): Observable<Item[]> { return this.http.get<Item[]>(`${API_BASE}/search`, { params: { q } }); }
  list(entity: string, q = '', offset = 0, limit = 48): Observable<Page<Item>> {
    return this.http.get<Page<Item>>(`${API_BASE}/entities/${entity}`, { params: { q, offset, limit } });
  }
  record(entity: string, id: string, first = 12): Observable<RecordView> {
    return this.http.get<RecordView>(`${API_BASE}/entities/${entity}/${encodeURIComponent(id)}`, { params: { first } });
  }
  related(entity: string, id: string, g: Group, offset: number, limit = 24): Observable<Page<Item>> {
    return this.http.get<Page<Item>>(`${API_BASE}/entities/${entity}/${encodeURIComponent(id)}/related/${encodeURIComponent(g.key)}`, { params: { offset, limit } });
  }
  trace(t: TraceQuery, offset = 0, limit = 100): Observable<TraceRows> {
    return this.http.get<TraceRows>(`${API_BASE}/trace`, { params: traceParams(t, { offset, limit }) });
  }
  traceSummary(t: TraceQuery): Observable<TraceSummary> {
    return this.http.get<TraceSummary>(`${API_BASE}/trace/summary`, { params: traceParams(t) });
  }
  ask(question: string): Observable<AskResult> { return this.http.post<AskResult>(`${API_BASE}/ask`, { question }); }
}
