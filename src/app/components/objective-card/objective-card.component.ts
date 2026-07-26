import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { Objective } from '../../models/objective.model';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Una riga "obiettivo" (progresso + reward) — usata sia dalla colonna a fine partita
 * (result.component) sia dalla pagina Obiettivi, invece di duplicare il markup. `reward.id` è
 * ancora un placeholder ('TODO_...', v. data/objectives.ts): mostrato con un'etichetta neutra
 * ("ricompensa da definire") finché i contenuti reali non sono decisi, non l'id grezzo.
 */
@Component({
  selector: 'app-objective-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div
      class="objective-card"
      [class.objective-card--completed]="completed()"
      [class.objective-card--claimed]="claimed()"
    >
      <div class="objective-card__info">
        <span class="objective-card__label">{{ metricLabel() }}</span>
        <span class="objective-card__reward t-muted">{{ rewardLabel() }}</span>
      </div>
      <div class="objective-card__track" role="progressbar" [attr.aria-valuenow]="displayProgress()"
        [attr.aria-valuemin]="0" [attr.aria-valuemax]="objective().threshold" [attr.aria-label]="metricLabel()">
        <div class="objective-card__fill" [style.width.%]="percent()"></div>
      </div>
      <div class="objective-card__footer">
        <span class="objective-card__count t-muted"
          >{{ displayProgress() }} / {{ objective().threshold }}</span
        >
        @if (completed() && !claimed()) {
          <button
            type="button"
            class="btn btn--primary objective-card__claim"
            (click)="claim.emit(objective().id)"
          >
            {{ 'objectives.claim' | translate }}
          </button>
        } @else if (claimed()) {
          <span class="objective-card__claimed-badge">✓ {{ 'objectives.claimed' | translate }}</span>
        }
      </div>
    </div>
  `,
  styleUrl: './objective-card.component.scss',
})
export class ObjectiveCardComponent {
  private readonly i18n = inject(TranslationService);

  readonly objective = input.required<Objective>();
  readonly progress = input.required<number>();
  readonly claimed = input(false);

  readonly claim = output<string>();

  protected readonly completed = computed(() => this.progress() >= this.objective().threshold);
  protected readonly displayProgress = computed(() =>
    Math.min(this.progress(), this.objective().threshold),
  );
  protected readonly percent = computed(() =>
    Math.min(100, (this.displayProgress() / this.objective().threshold) * 100),
  );
  protected readonly metricLabel = computed(
    () => `${this.i18n.t(`objectives.metricLabels.${this.objective().metric}`)} · ${this.objective().threshold}`,
  );
  protected readonly rewardLabel = computed(() => this.i18n.t('objectives.rewardPending'));
}
