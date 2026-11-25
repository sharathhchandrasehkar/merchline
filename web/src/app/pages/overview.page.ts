import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api.service';
import { Catalog } from '../core/catalog.service';
import { compact, pct } from '../core/format';
import type { Overview } from '../core/models';
import { ThumbComponent } from '../shared/thumb.component';

type Measure = 'styles' | 'colorways' | 'margin';

/** The whole catalog at a glance: table sizes, a category × season heatmap and the weakest margins. */
@Component({
  selector: 'ml-overview',
  imports: [RouterLink, ThumbComponent],
  template: `
    <div class="page-head"><div><p class="eyebrow">Overview</p><h1>The catalog at a glance</h1>
      <p class="hint">Start from the summary, then narrow down. Click a season column to trace its styles.</p></div></div>
    @if (data(); as d) {
      <div class="kpis five">
        @for (k of KPIS; track k) {
          <a class="kpi" [routerLink]="['/explore', k]"><p class="eyebrow">{{ catalog.plural(k) }}</p><p class="kv">{{ compact(d.counts[k] || 0) }}</p></a>
        }
      </div>
      <div class="ov">
        <section class="panel">
          <div class="panel-head"><h2>Category × season</h2>
            <div class="seg sm" role="group" aria-label="Measure">
              <button type="button" [attr.aria-pressed]="measure() === 'styles'" (click)="measure.set('styles')">Styles</button>
              <button type="button" [attr.aria-pressed]="measure() === 'colorways'" (click)="measure.set('colorways')">Colorways</button>
              <button type="button" [attr.aria-pressed]="measure() === 'margin'" (click)="measure.set('margin')">Avg margin</button>
            </div></div>
          <div class="tablewrap">
            <table class="mtx">
              <thead><tr><th></th>@for (s of d.seasons; track s) {
                <th scope="col"><a [routerLink]="['/trace']" [queryParams]="{ start: 'Product', seasons: s }">{{ s }}</a></th> }</tr></thead>
              <tbody>
                @for (c of d.categories; track c; let ci = $index) {
                  <tr><th scope="row">{{ c }}</th>
                    @for (s of d.seasons; track s; let si = $index) {
                      @let v = grid()[ci][si];
                      <td>@if (v == null) { <span class="mcell empty">—</span> } @else {
                        <span class="mcell" [style.background]="shade(v)" [style.color]="ink(v)" [title]="c + ' · ' + s + ': ' + label(v)">{{ label(v) }}</span> }</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="hint">Darker cells have more {{ measure() === 'margin' ? 'margin' : measure() }}.</p>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Lowest margins</h2></div>
          <ul class="watch">
            @for (w of d.watch; track w.id) {
              <li><a [routerLink]="['/explore', 'Product', w.id]"><ml-thumb [thumb]="w.thumb" [size]="40" />
                <span class="rtext"><span class="rl">{{ w.label }}</span><span class="rid">{{ w.category }} · {{ w.colorways }} colorways</span></span>
                <span class="mbar"><i [style.width.px]="w.margin * 70"></i><b>{{ pct(w.margin) }}</b></span></a></li>
            }
          </ul>
        </section>
      </div>
    } @else { <p class="note">Loading…</p> }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPage {
  protected catalog = inject(Catalog);
  private api = inject(Api);
  protected KPIS = ['Product', 'Sku', 'Bomlink', 'Costsheet', 'Supplier'];
  protected data = signal<Overview | null>(null);
  protected measure = signal<Measure>('styles');
  protected compact = compact;
  protected pct = pct;
  protected grid = computed(() => this.data()?.matrix[this.measure()] || []);
  private range = computed(() => { const v = this.grid().flat().filter((x): x is number => x != null); return [Math.min(...v), Math.max(...v)]; });

  constructor() {
    effect(() => { if (this.catalog.meta()) this.api.overview().subscribe((d) => this.data.set(d)); });
  }
  private t(v: number) { const [a, b] = this.range(); return b > a ? (v - a) / (b - a) : 1; }
  protected shade(v: number) { return `color-mix(in oklab, var(--seq-hi) ${Math.round(8 + this.t(v) * 80)}%, var(--seq-lo))`; }
  protected ink(v: number) { return this.t(v) > 0.55 ? 'var(--seq-on-hi)' : 'var(--fg)'; }
  protected label(v: number) { return this.measure() === 'margin' ? pct(v) : compact(v); }
}
