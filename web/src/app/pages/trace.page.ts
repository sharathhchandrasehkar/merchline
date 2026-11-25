import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, type TraceQuery } from '../core/api.service';
import { Catalog } from '../core/catalog.service';
import { GROUP_COLOR, compact, money, num, pct, tone } from '../core/format';
import type { AskResult, Field, TraceSummary } from '../core/models';
import { ThumbComponent } from '../shared/thumb.component';

type Col = { key: string; label: string; type: string };

/** Trace to season: every path from the chosen records up to Season, one row per path, one column group per table. */
@Component({
  selector: 'ml-trace',
  imports: [FormsModule, RouterLink, ThumbComponent],
  template: `
    <div class="trace">
      <aside class="builder" aria-label="Trace builder">
        <label class="f">Start from
          <select [ngModel]="start()" (ngModelChange)="set({ start: $event, q: null, id: null })">
            @for (s of catalog.meta()?.traceStarts || []; track s) { <option [value]="s">{{ catalog.plural(s) }}</option> }
          </select></label>
        <label class="f">Find
          <input type="search" [ngModel]="q() || ''" (ngModelChange)="typeQ($event)" placeholder="Name or ID; leave empty for all" />
        </label>
        @if (id()) { <p class="chip">Tracing one record: <span class="mono">{{ id() }}</span> <button type="button" (click)="set({ id: null })" aria-label="Trace all instead">×</button></p> }
        <fieldset class="f"><legend>Seasons</legend>
          <div class="chips">
            @for (s of catalog.meta()?.seasons || []; track s) {
              <label class="schip"><input type="checkbox" [checked]="seasons().includes(s)" (change)="toggleSeason(s)" />{{ s }}</label>
            }
          </div>
          <p class="hint">{{ seasons().length ? 'Only paths that reach these seasons.' : 'All seasons.' }}</p>
        </fieldset>
        <div class="f">Columns
          <div class="seg sm" role="group"><button type="button" [attr.aria-pressed]="!all()" (click)="all.set(false)">Key fields</button>
            <button type="button" [attr.aria-pressed]="all()" (click)="all.set(true)">All fields</button></div></div>
      </aside>

      <div class="trace-main">
        @if (asked(); as a) {
          <div class="asked"><span class="eyebrow">{{ a.engine === 'claude' ? 'Claude read your question' : 'Read in keyword mode' }}</span>
            <p>“{{ a.question }}” → {{ a.explanation }}</p></div>
        }
        <div class="panel">
          <p class="eyebrow">Trace to season</p>
          <h1 class="trh">{{ title() }}</h1>
          <div class="tpath" role="group" aria-label="Tables in this trace">
            @for (g of groups(); track g; let i = $index) {
              @if (i) { <span class="tarrow" aria-hidden="true">→</span> }
              <button type="button" class="tstep" [attr.aria-pressed]="!hidden().has(g)" [disabled]="i === 0" (click)="toggleGroup(g)">
                <i class="gdot" [style.background]="gcolor(g)"></i>{{ catalog.singular(g) }}</button>
            }
          </div>
          <p class="hint">Each row is one complete path up to a season. Click a table above to hide or show its columns.
            @if (catalog.technical() && joins().length) { Joins: {{ joins() }} }</p>
        </div>

        <div class="kpis">
          <div class="kpi"><p class="eyebrow">Paths to season</p><p class="kv">{{ summary() ? summary()!.paths.toLocaleString('en-US') : '…' }}</p></div>
          <div class="kpi"><p class="eyebrow">Styles reached</p><p class="kv">{{ summary() ? summary()!.styles.toLocaleString('en-US') : '…' }}</p></div>
          <div class="kpi wide"><p class="eyebrow">By season</p>
            <div class="sbars">
              @for (s of seasonBars(); track s.code) {
                <button type="button" class="sbar" (click)="onlySeason(s.code)" [title]="s.code + ': ' + s.n.toLocaleString('en-US') + ' paths. Click to filter.'">
                  <span>{{ s.code }}</span><i [style.width.%]="s.w"></i><b>{{ compact(s.n) }}</b></button>
              }
            </div></div>
        </div>

        <div class="panel">
          @if (rows().length) {
            <div class="ttwrap">
              <table class="ttable">
                <thead>
                  <tr>@for (g of visible(); track g.name) {
                    <th scope="colgroup" [attr.colspan]="g.cols.length" [style.box-shadow]="'inset 0 3px 0 ' + gcolor(g.name)">
                      <i class="gdot" [style.background]="gcolor(g.name)"></i>{{ catalog.singular(g.name) }}</th> }</tr>
                  <tr>@for (g of visible(); track g.name; let gi = $index) { @for (c of g.cols; track c.key; let ci = $index) {
                    <th scope="col" [class.stick]="gi === 0 && ci === 0">{{ c.label }}</th> } }</tr>
                </thead>
                <tbody>
                  @for (row of rows(); track $index; let ri = $index) {
                    <tr>@for (g of visible(); track g.name; let gi = $index) {
                      @for (c of g.cols; track c.key; let ci = $index) {
                        <td [class.stick]="gi === 0 && ci === 0" [class.num]="isNum(c)" [class.rep]="same(ri, g.name) && !(gi === 0 && ci === 0)">
                          @if (c.key === '__name') { <span class="tnx"><ml-thumb [thumb]="row[g.name]?.['thumb']" [size]="22" /><span>{{ row[g.name]?.['label'] }}</span></span> }
                          @else if (c.key === '__id') { <a class="mono" [routerLink]="['/explore', g.name, row[g.name]?.[pk(g.name)]]">{{ row[g.name]?.[pk(g.name)] }}</a> }
                          @else if (c.type === 'status') { <span [class]="'pill ' + toneOf(row[g.name]?.[c.key])">{{ row[g.name]?.[c.key] }}</span> }
                          @else if (c.type === 'hex') { <span class="sw" [style.background]="row[g.name]?.[c.key]"></span>{{ row[g.name]?.[c.key] }} }
                          @else { {{ fmt(row[g.name]?.[c.key], c, row[g.name]) }} }
                        </td>
                      }
                    }</tr>
                  }
                </tbody>
              </table>
            </div>
          } @else { <p class="note">{{ loading() ? 'Finding paths…' : 'No paths reach a season for this search. Try another search or clear the season filter.' }}</p> }
          <div class="more">
            <span class="hint">{{ rows().length.toLocaleString('en-US') }} rows loaded{{ done() ? ' (all)' : '' }}</span>
            @if (!done() && rows().length) { <button class="btn" (click)="load(true)" [disabled]="loading()">Load 100 more</button> }
            <button class="btn" (click)="copyCsv()" [disabled]="!rows().length">Copy loaded rows as CSV</button>
            <span class="hint" aria-live="polite">{{ copied() }}</span>
          </div>
          @if (csv()) { <textarea class="copybox" readonly [value]="csv()" aria-label="CSV"></textarea> }
        </div>
      </div>
    </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TracePage {
  protected catalog = inject(Catalog);
  private api = inject(Api);
  private router = inject(Router);
  // query parameters (bound by the router)
  readonly startParam = input<string>('', { alias: 'start' });
  readonly q = input<string | undefined>(undefined);
  readonly id = input<string | undefined>(undefined);
  readonly seasonsParam = input<string | undefined>(undefined, { alias: 'seasons' });

  protected start = computed(() => this.startParam() || 'Materialcolor');
  protected seasons = computed(() => (this.seasonsParam() || '').split(',').filter(Boolean));
  protected all = signal(false);
  protected hidden = signal(new Set<string>());
  protected groups = signal<string[]>([]);
  protected joinList = signal<{ entity: string; on: string }[]>([]);
  protected rows = signal<Record<string, Record<string, any>>[]>([]);
  protected summary = signal<TraceSummary | null>(null);
  protected loading = signal(false);
  protected done = signal(false);
  protected copied = signal('');
  protected csv = signal('');
  protected asked = signal<(AskResult & { question: string }) | null>(null);
  protected compact = compact;
  private qTimer: ReturnType<typeof setTimeout> | undefined;

  protected visible = computed(() => this.groups().filter((g, i) => i === 0 || !this.hidden().has(g)).map((g) => ({ name: g, cols: this.colsFor(g) })));
  protected joins = computed(() => this.joinList().map((j) => `${j.entity} (${j.on})`).join(' → '));
  protected title = computed(() => {
    const p = this.catalog.plural(this.start());
    if (this.id()) return `${this.catalog.singular(this.start())} ${this.id()}, traced to season`;
    return this.q() ? `${p} matching “${this.q()}”, traced to season` : `All ${p.toLowerCase()}, traced to season`;
  });
  protected seasonBars = computed(() => {
    const b = this.summary()?.bySeason || {}, max = Math.max(1, ...Object.values(b));
    return (this.catalog.meta()?.seasons || []).filter((s) => b[s]).map((s) => ({ code: s, n: b[s], w: Math.max(4, (b[s] / max) * 100) }));
  });

  constructor() {
    const st = this.router.getCurrentNavigation()?.extras.state as { ask?: AskResult & { question: string } } | undefined;
    if (st?.ask) this.asked.set(st.ask);
    effect(() => {
      const t: TraceQuery = { start: this.start(), q: this.q(), id: this.id(), seasons: this.seasons() };
      if (!this.catalog.meta()) return;
      untracked(() => this.run(t));
    });
  }

  private query(): TraceQuery { return { start: this.start(), q: this.q(), id: this.id(), seasons: this.seasons() }; }
  private run(t: TraceQuery) {
    this.rows.set([]); this.summary.set(null); this.done.set(false); this.csv.set(''); this.copied.set('');
    this.load(false);
    this.api.traceSummary(t).subscribe((s) => this.summary.set(s));
  }
  load(more: boolean) {
    this.loading.set(true);
    this.api.trace(this.query(), more ? this.rows().length : 0, 100).subscribe({
      next: (r) => {
        this.groups.set(r.groups); this.joinList.set(r.joins);
        this.rows.set(more ? [...this.rows(), ...r.rows] : r.rows);
        this.done.set(r.rows.length < 100); this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
  set(p: Record<string, string | null>) {
    if (p['start'] !== undefined) this.hidden.set(new Set());
    this.asked.set(null);
    this.router.navigate([], { queryParams: p, queryParamsHandling: 'merge', replaceUrl: true });
  }
  typeQ(v: string) { clearTimeout(this.qTimer); this.qTimer = setTimeout(() => this.set({ q: v || null, id: null }), 350); }
  toggleSeason(s: string) {
    const cur = new Set(this.seasons()); cur.has(s) ? cur.delete(s) : cur.add(s);
    this.set({ seasons: cur.size ? [...cur].join(',') : null });
  }
  onlySeason(s: string) { this.set({ seasons: this.seasons().length === 1 && this.seasons()[0] === s ? null : s }); }
  toggleGroup(g: string) { const h = new Set(this.hidden()); h.has(g) ? h.delete(g) : h.add(g); this.hidden.set(h); }

  protected gcolor(g: string) { return GROUP_COLOR[this.catalog.entity(g)?.group || 'product']; }
  protected pk(g: string) { return this.catalog.entity(g)?.pk || ''; }
  protected toneOf(v: unknown) { return tone(String(v)); }
  protected isNum(c: Col) { return ['money', 'pct', 'num', 'cons'].includes(c.type); }
  protected same(ri: number, g: string) {
    const prev = this.rows()[ri - 1], cur = this.rows()[ri], k = this.pk(g);
    return !!prev && prev[g]?.[k] === cur[g]?.[k];
  }
  private colsFor(g: string): Col[] {
    const e = this.catalog.entity(g); if (!e) return [];
    const own = e.fields.filter((f: Field) => f.type !== 'fk');
    return [{ key: '__name', label: 'Name', type: 'text' }, { key: '__id', label: 'ID', type: 'mono' }, ...(this.all() ? own : own.slice(0, 2))];
  }
  protected fmt(v: any, c: Col, rec?: Record<string, any>) {
    if (v == null) return '—';
    switch (c.type) { case 'money': return money(v); case 'pct': return pct(v); case 'num': return num(v); case 'cons': return `${v} ${rec?.['uom'] ?? ''}`; default: return String(v); }
  }
  copyCsv() {
    const cols = this.visible().flatMap((g) => g.cols.map((c) => [g.name, c] as const));
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const raw = (g: string, c: Col, r: Record<string, Record<string, any>>) => {
      const rec = r[g]; if (!rec) return '';
      if (c.key === '__name') return String(rec['label']); if (c.key === '__id') return String(rec[this.pk(g)]);
      const v = rec[c.key]; return v == null ? '' : c.type === 'pct' ? (v * 100).toFixed(1) : String(v);
    };
    const text = [cols.map(([g, c]) => esc(`${this.catalog.singular(g)}: ${c.label}`)).join(','),
      ...this.rows().map((r) => cols.map(([g, c]) => esc(raw(g, c, r))).join(','))].join('\n');
    const fallback = () => { this.csv.set(text); this.copied.set('Select all and copy the text below.'); };
    navigator.clipboard?.writeText(text).then(() => this.copied.set(`Copied ${this.rows().length} rows. Paste into Excel or Google Sheets.`), fallback) ?? fallback();
  }
}
