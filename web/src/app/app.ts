import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { Api } from './core/api.service';
import { Catalog } from './core/catalog.service';
import type { Item } from './core/models';
import { ThumbComponent } from './shared/thumb.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, ThumbComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected catalog = inject(Catalog);
  private api = inject(Api);
  private router = inject(Router);
  protected query = '';
  protected results = signal<Item[]>([]);
  protected open = signal(false);
  private typed = new Subject<string>();

  constructor() {
    this.typed.pipe(debounceTime(200), distinctUntilChanged(), filter((q) => q.trim().length >= 2), switchMap((q) => this.api.search(q)))
      .subscribe((r) => { this.results.set(r); this.open.set(true); });
  }
  onType(v: string) { this.typed.next(v); if (v.trim().length < 2) { this.results.set([]); this.open.set(false); } }
  pick(i: Item) { this.open.set(false); this.query = ''; this.router.navigate(['/explore', i.entity, i.id]); }
  closeSoon() { setTimeout(() => this.open.set(false), 150); }
  cycleTheme() { const t = this.catalog.theme(); this.catalog.setTheme(t === 'system' ? 'dark' : t === 'dark' ? 'light' : 'system'); }
}
