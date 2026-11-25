import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from './api.service';
import type { Entity, Health, Meta } from './models';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** App-wide state: the data model (loaded once), server readiness and display preferences. */
@Injectable({ providedIn: 'root' })
export class Catalog {
  private api = inject(Api);
  readonly meta = signal<Meta | null>(null);
  readonly health = signal<Health | null>(null);
  readonly waking = signal(false);
  readonly error = signal('');
  readonly technical = signal(store.get('ml-audience') === 'tech');
  readonly theme = signal<'system' | 'light' | 'dark'>((store.get('ml-theme') as any) || 'system');
  readonly entities = computed(() => new Map((this.meta()?.entities || []).map((e) => [e.name, e])));

  constructor() {
    this.applyTheme();
    this.connect();
  }

  /** The free API host sleeps when idle; keep polling /health until it answers and the data is ready. */
  private connect(attempt = 0) {
    const slow = setTimeout(() => this.waking.set(true), 2500);
    this.api.health().subscribe({
      next: (h) => {
        clearTimeout(slow); this.health.set(h);
        if (!h.seeded) { this.waking.set(true); setTimeout(() => this.connect(attempt + 1), 4000); return; }
        this.waking.set(false); this.error.set('');
        if (!this.meta()) this.api.meta().subscribe((m) => this.meta.set(m));
      },
      error: () => {
        clearTimeout(slow); this.waking.set(true);
        if (attempt > 40) { this.error.set('The server is not responding. Please try again later.'); return; }
        setTimeout(() => this.connect(attempt + 1), 3000);
      },
    });
  }

  entity(name: string): Entity | undefined { return this.entities().get(name); }
  /** Business vocabulary by default; technical table names when the audience is Technical. */
  plural(name: string) { const e = this.entity(name); return this.technical() ? name : e?.plural || name; }
  singular(name: string) { const e = this.entity(name); return this.technical() ? name : e?.singular || name; }

  setTechnical(v: boolean) { this.technical.set(v); store.set('ml-audience', v ? 'tech' : 'biz'); }
  setTheme(t: 'system' | 'light' | 'dark') { this.theme.set(t); store.set('ml-theme', t); this.applyTheme(); }
  private applyTheme() {
    const t = this.theme(), root = document.documentElement;
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  }
}
