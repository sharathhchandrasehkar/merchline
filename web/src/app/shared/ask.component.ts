import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../core/api.service';
import { Catalog } from '../core/catalog.service';

/** "Ask Merchline": a plain-English question becomes a trace-to-season report. */
@Component({
  selector: 'ml-ask',
  imports: [FormsModule],
  template: `
    <form class="ask" (ngSubmit)="go()" role="search">
      <label class="ask-label" for="ask-q">Ask Merchline</label>
      <div class="ask-row">
        <input id="ask-q" name="q" [(ngModel)]="question" [placeholder]="placeholder()" autocomplete="off" maxlength="300" />
        <button class="btn primary" type="submit" [disabled]="busy() || question.trim().length < 3">{{ busy() ? 'Thinking…' : 'Ask' }}</button>
      </div>
      @if (examples()) {
        <div class="ask-ex">
          @for (ex of EXAMPLES; track ex) { <button type="button" class="chip-btn" (click)="question = ex; go()">{{ ex }}</button> }
        </div>
      }
      <p class="hint">
        @if (catalog.meta()?.ai) { Answers are worked out by Claude, then run as a trace-to-season report. }
        @else { Running in keyword mode. Set ANTHROPIC_API_KEY on the API to let Claude read questions. }
      </p>
      @if (error()) { <p class="err">{{ error() }}</p> }
    </form>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskComponent {
  protected catalog = inject(Catalog);
  private api = inject(Api);
  private router = inject(Router);
  readonly examples = input(true);
  readonly placeholder = input('e.g. Which FW26 styles use ripstop?');
  protected readonly EXAMPLES = ['Which FW26 styles use ripstop?', 'What does Boreal supply in SS26?', 'Lab dips for black fabrics', 'Margins on Summit jackets'];
  protected question = '';
  protected busy = signal(false);
  protected error = signal('');

  go() {
    const q = this.question.trim();
    if (q.length < 3 || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.api.ask(q).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.router.navigate(['/trace'], {
          queryParams: { start: r.start, q: r.q || null, seasons: r.seasons.length ? r.seasons.join(',') : null },
          state: { ask: { question: q, ...r } },
        });
      },
      error: () => { this.busy.set(false); this.error.set('Could not answer that right now. Try rephrasing, or use Trace directly.'); },
    });
  }
}
