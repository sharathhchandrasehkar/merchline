import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../core/api.service';
import { Catalog } from '../core/catalog.service';
import { compact, GROUP_COLOR } from '../core/format';
import type { Item } from '../core/models';
import { AskComponent } from '../shared/ask.component';
import { ThumbComponent } from '../shared/thumb.component';

const STAGES: [string, string, string[]][] = [
  ['Plan', 'what goes to market, when', ['Season']],
  ['Design', 'the range and its colors', ['Product', 'Sku']],
  ['Build', 'what each style is made of', ['BOMPart', 'Bomlink']],
  ['Source & cost', 'who makes it, at what cost', ['Sourcingconfiguration', 'Costsheet', 'Skucostsheet']],
];
const LIBS = ['Material', 'Color', 'Supplier'];

@Component({
  selector: 'ml-home',
  imports: [RouterLink, NgTemplateOutlet, AskComponent, ThumbComponent],
  template: `
    <section class="hero-band">
      <div>
        <p class="eyebrow">Product data explorer</p>
        <h1>Follow any product record all the way to the season it sells in.</h1>
        <p class="lede">Merchline connects styles, colorways, bills of materials, suppliers, factories and costs.
          Open any record, see everything linked to it, and trace it back to season in one report.</p>
      </div>
      <ml-ask />
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Where do you want to start?</h2><span class="hint">{{ total() }}</span></div>
      <div class="stages">
        @for (s of STAGES; track s[0]; let i = $index) {
          <div class="stage">
            <h3><span class="n">{{ i + 1 }}</span>{{ s[0] }}<span class="sd">{{ s[1] }}</span></h3>
            @for (e of s[2]; track e) { <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ e }" /> }
          </div>
        }
      </div>
      <h3 class="libhead">Libraries <span>shared by every style</span></h3>
      <div class="libs">
        @for (e of LIBS; track e) { <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ e }" /> }
      </div>
    </section>

    <ng-template #card let-e="e">
      <a class="ecard" [routerLink]="['/explore', e]">
        <span class="strip">@for (t of samples()[e] || []; track t.id) { <ml-thumb [thumb]="t.thumb" [size]="28" /> }</span>
        <span class="et"><i class="gdot" [style.background]="color(e)"></i>{{ catalog.plural(e) }}<span class="count">{{ count(e) }}</span></span>
        <span class="ed">{{ catalog.entity(e)?.description }}</span>
      </a>
    </ng-template>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected catalog = inject(Catalog);
  private api = inject(Api);
  protected STAGES = STAGES;
  protected LIBS = LIBS;
  protected samples = signal<Record<string, Item[]>>({});
  protected counts = signal<Record<string, number>>({});

  constructor() {
    effect(() => {
      if (!this.catalog.meta()) return;
      const names = [...STAGES.flatMap((s) => s[2]), ...LIBS];
      forkJoin(Object.fromEntries(names.map((n) => [n, this.api.list(n, '', 0, 5)]))).subscribe((r) => {
        this.samples.set(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.items])));
        this.counts.set(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.total])));
      });
    });
  }
  protected count(e: string) { const n = this.counts()[e]; return n == null ? '' : compact(n); }
  protected color(e: string) { return GROUP_COLOR[this.catalog.entity(e)?.group || 'product']; }
  protected total() {
    const c = this.counts(); const n = Object.values(c).reduce((a, b) => a + b, 0);
    return n ? `${n.toLocaleString('en-US')} linked records across 15 tables` : '';
  }
}
