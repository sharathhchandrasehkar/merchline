import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Api } from '../core/api.service';
import { Catalog } from '../core/catalog.service';
import { GROUP_COLOR } from '../core/format';
import type { Item } from '../core/models';
import { ItemCardComponent } from '../shared/item-card.component';

@Component({
  selector: 'ml-list',
  imports: [FormsModule, RouterLink, ItemCardComponent],
  template: `
    <div class="page-head">
      <div>
        <p class="eyebrow">Explore</p>
        <h1><i class="gdot big" [style.background]="color()"></i>{{ catalog.plural(entity()) }} <span class="count">{{ total().toLocaleString('en-US') }}</span></h1>
        <p class="hint">{{ catalog.entity(entity())?.description }}</p>
      </div>
      <div class="tabs" role="tablist" aria-label="Tables">
        @for (e of catalog.meta()?.entities || []; track e.name) {
          <a role="tab" [routerLink]="['/explore', e.name]" [class.on]="e.name === entity()" [attr.aria-selected]="e.name === entity()">{{ catalog.plural(e.name) }}</a>
        }
      </div>
    </div>
    <div class="toolbar">
      <input type="search" class="filter" [(ngModel)]="q" (ngModelChange)="typed.next($event)" [placeholder]="'Search ' + catalog.plural(entity()).toLowerCase() + ' by name or ID'" aria-label="Search" />
      @if (catalog.entity(entity()) && traceable()) {
        <a class="btn" [routerLink]="['/trace']" [queryParams]="{ start: entity(), q: q || null }">Trace these to season</a>
      }
    </div>
    @if (loading() && !items().length) { <p class="note">Loading…</p> }
    @else if (!items().length) { <p class="note">Nothing matches “{{ q }}”.</p> }
    <div class="tiles">@for (it of items(); track it.id) { <ml-item-card [item]="it" /> }</div>
    @if (items().length < total()) {
      <div class="more"><span class="hint">{{ items().length.toLocaleString('en-US') }} of {{ total().toLocaleString('en-US') }}</span>
        <button class="btn" (click)="load(true)" [disabled]="loading()">Load {{ 48 }} more</button></div>
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListPage {
  protected catalog = inject(Catalog);
  private api = inject(Api);
  readonly entity = input.required<string>();
  protected q = '';
  protected items = signal<Item[]>([]);
  protected total = signal(0);
  protected loading = signal(false);
  protected typed = new Subject<string>();
  protected traceable = computed(() => !!this.catalog.meta()?.traceStarts.includes(this.entity()));
  protected color = computed(() => GROUP_COLOR[this.catalog.entity(this.entity())?.group || 'product']);

  constructor() {
    effect(() => { this.entity(); if (this.catalog.meta()) { this.q = ''; this.load(false); } });
    this.typed.pipe(debounceTime(250)).subscribe(() => this.load(false));
  }
  load(more: boolean) {
    this.loading.set(true);
    this.api.list(this.entity(), this.q, more ? this.items().length : 0, 48).subscribe({
      next: (p) => { this.items.set(more ? [...this.items(), ...p.items] : p.items); this.total.set(p.total); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
