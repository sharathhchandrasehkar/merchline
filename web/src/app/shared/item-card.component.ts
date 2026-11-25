import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Catalog } from '../core/catalog.service';
import type { Item } from '../core/models';
import { ThumbComponent } from './thumb.component';

/** A picture tile for one record; links to its page. */
@Component({
  selector: 'ml-item-card',
  imports: [RouterLink, ThumbComponent],
  template: `
    <a class="tile" [routerLink]="['/explore', item().entity, item().id]">
      <ml-thumb [thumb]="item().thumb" [size]="null" />
      <span class="tl">{{ item().label }}</span>
      <span class="tm2">{{ catalog.technical() ? item().id : item().metric }}</span>
    </a>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
})
export class ItemCardComponent {
  protected catalog = inject(Catalog);
  readonly item = input.required<Item>();
}
