import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { Thumb } from '../core/models';
import { thumbSvg } from './thumb';

@Component({
  selector: 'ml-thumb',
  template: `<span class="tw" [style.width.px]="size()" [style.height.px]="size()" [innerHTML]="svg()"></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
})
export class ThumbComponent {
  private sanitizer = inject(DomSanitizer);
  readonly thumb = input<Thumb>(null);
  readonly size = input<number | null>(40);
  // thumbSvg only emits fixed shapes, validated #hex colors and filtered text, so it is safe to trust
  readonly svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(thumbSvg(this.thumb())));
}
