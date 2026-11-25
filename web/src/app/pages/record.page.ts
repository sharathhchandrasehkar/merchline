import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Catalog } from '../core/catalog.service';
import { GROUP_COLOR } from '../core/format';
import type { Group, RecordView } from '../core/models';
import { ItemCardComponent } from '../shared/item-card.component';
import { ThumbComponent } from '../shared/thumb.component';
import { ValueComponent } from '../shared/value.component';

interface Crumb { entity: string; id: string; label: string }
const trail = signal<Crumb[]>([]);   // the path the user has walked, kept across record pages

/** Board view of one record: the record on the left, every relationship as a wall of tiles on the right. */
@Component({
  selector: 'ml-record',
  imports: [RouterLink, ItemCardComponent, ThumbComponent, ValueComponent],
  template: `
    @if (trailView().length > 1) {
      <nav class="crumbs" aria-label="Your path">
        @for (c of trailView(); track c.entity + c.id; let last = $last) {
          @if (!last) { <a [routerLink]="['/explore', c.entity, c.id]">{{ c.label }}</a><span class="sep">›</span> }
          @else { <span aria-current="page">{{ c.label }}</span> }
        }
      </nav>
    }
    @if (error()) { <p class="note">{{ error() }}</p> }
    @if (rec(); as r) {
      <div class="board">
        <aside class="bhero">
          <div class="hero"><ml-thumb [thumb]="r.row['thumb']" [size]="null" /></div>
          <div class="bh">
            <p class="eyebrow"><i class="gdot" [style.background]="color()"></i>{{ catalog.singular(r.entity) }}
              @if (catalog.technical()) { · <span class="mono">{{ r.id }}</span> }</p>
            <h1>{{ r.row['label'] }}</h1>
          </div>
          <dl class="fields">
            @for (f of fields(); track f.key) { <dt>{{ f.label }}</dt><dd><ml-value [field]="f" [row]="r.row" [refs]="r.refs" /></dd> }
          </dl>
          <div class="bactions">
            @if (traceable()) {
              <a class="btn primary" [routerLink]="['/trace']" [queryParams]="{ start: r.entity, id: r.id }">Trace to season</a>
            }
            <a class="btn" [routerLink]="['/explore', r.entity]">All {{ catalog.plural(r.entity).toLowerCase() }}</a>
          </div>
        </aside>
        <div class="bsecs">
          @for (g of withItems(); track g.key + g.dir) {
            <section class="bsec">
              <h2><span class="dir">{{ g.dir === 'up' ? 'Part of' : 'Contains' }}</span><i class="gdot" [style.background]="groupColor(g)"></i>
                {{ catalog.technical() ? g.entity : g.title }}<span class="count">{{ g.total.toLocaleString('en-US') }}</span>
                @if (catalog.technical()) { <span class="via mono">via {{ g.keys.join(' + ') }}</span> }</h2>
              <div class="tiles">@for (it of g.items; track it.id) { <ml-item-card [item]="it" /> }</div>
              @if (g.items.length < g.total) {
                <div class="more"><span class="hint">{{ g.items.length.toLocaleString('en-US') }} of {{ g.total.toLocaleString('en-US') }}</span>
                  <button class="btn" (click)="more(g)" [disabled]="busy() === g.key">Show {{ Math.min(24, g.total - g.items.length) }} more</button></div>
              }
            </section>
          }
          @if (empty().length) { <p class="note">No linked records in {{ empty().join(', ') }}.</p> }
        </div>
      </div>
    } @else if (!error()) { <p class="note">Loading…</p> }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordPage {
  protected catalog = inject(Catalog);
  private api = inject(Api);
  readonly entity = input.required<string>();
  readonly id = input.required<string>();
  protected Math = Math;
  protected rec = signal<RecordView | null>(null);
  protected error = signal('');
  protected busy = signal('');
  protected fields = computed(() => this.catalog.entity(this.entity())?.fields || []);
  protected color = computed(() => GROUP_COLOR[this.catalog.entity(this.entity())?.group || 'product']);
  protected traceable = computed(() => !!this.catalog.meta()?.traceStarts.includes(this.entity()));
  protected withItems = computed(() => (this.rec()?.groups || []).filter((g) => g.total > 0));
  protected empty = computed(() => (this.rec()?.groups || []).filter((g) => !g.total).map((g) => (this.catalog.technical() ? g.entity : g.title)));
  protected trailView = computed(() => trail());

  constructor() {
    effect(() => {
      const e = this.entity(), id = this.id();
      if (!this.catalog.meta()) return;
      this.rec.set(null); this.error.set('');
      this.api.record(e, id).subscribe({
        next: (r) => {
          this.rec.set(r);
          const c: Crumb = { entity: e, id, label: String(r.row['label']) };
          const t = trail(), at = t.findIndex((x) => x.entity === e && x.id === id);
          trail.set(at >= 0 ? t.slice(0, at + 1) : [...t, c].slice(-8));
        },
        error: (err) => this.error.set(err.status === 404 ? 'That record does not exist.' : 'Could not load this record.'),
      });
    });
  }
  protected groupColor(g: Group) { return GROUP_COLOR[this.catalog.entity(g.entity)?.group || 'product']; }
  protected more(g: Group) {
    const r = this.rec(); if (!r) return;
    this.busy.set(g.key);
    this.api.related(r.entity, r.id, g, g.items.length, 24).subscribe((p) => {
      this.busy.set('');
      this.rec.set({ ...r, groups: r.groups.map((x) => (x === g ? { ...x, items: [...x.items, ...p.items] } : x)) });
    });
  }
}
