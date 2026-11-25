import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Catalog } from '../core/catalog.service';
import { money, num, pct, tone } from '../core/format';
import type { Field, Item } from '../core/models';
import { ThumbComponent } from './thumb.component';

/** Formats one field value: money, percentages, status pills, swatches and links to related records. */
@Component({
  selector: 'ml-value',
  imports: [RouterLink, ThumbComponent],
  template: `
    @switch (field().type) {
      @case ('fk') {
        @if (refItem(); as r) {
          <a class="fk" [routerLink]="['/explore', r.entity, r.id]"><ml-thumb [thumb]="r.thumb" [size]="24" /><span>{{ r.label }}</span>
            @if (catalog.technical()) { <span class="mono dim">{{ r.id }}</span> }</a>
        } @else { <span class="mono">{{ value() }}</span> }
      }
      @case ('status') { <span class="pill" [class]="'pill ' + toneOf()">{{ value() }}</span> }
      @case ('hex') { <span class="sw" [style.background]="value()"></span><span class="mono">{{ value() }}</span> }
      @case ('mono') { <span class="mono">{{ value() }}</span> }
      @default { {{ text() }} }
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValueComponent {
  protected catalog = inject(Catalog);
  readonly field = input.required<Field>();
  readonly row = input.required<Record<string, any>>();
  readonly refs = input<Record<string, Item>>({});
  protected value = computed(() => this.row()[this.field().key]);
  protected refItem = computed(() => this.refs()[this.field().key]);
  protected toneOf = computed(() => tone(String(this.value())));
  protected text = computed(() => {
    const v = this.value(), t = this.field().type;
    if (v == null) return '—';
    if (t === 'money') return money(v); if (t === 'pct') return pct(v); if (t === 'num') return num(v);
    if (t === 'cons') return `${v} ${this.row()['uom'] ?? ''}`;
    return String(v);
  });
}
