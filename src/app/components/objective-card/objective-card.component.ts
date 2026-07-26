import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { Objective, ObjectiveReward } from '../../models/objective.model';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Una riga "obiettivo" (progresso + reward) — usata sia dalla colonna a fine partita
 * (result.component) sia dalla pagina Obiettivi, invece di duplicare il markup. Un obiettivo può
 * dare più ricompense insieme (`Objective.rewards`, v. data/objectives.ts) — mostrate tutte,
 * separate da "+". `reward.id` ancora un placeholder ('TODO_...') è mostrato con un'etichetta
 * neutra ("ricompensa da definire"), non l'id grezzo.
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
  /** La maggior parte dei reward sono ancora placeholder ('TODO_...', v. data/objectives.ts) — mai
   * mostrati grezzi, solo l'etichetta neutra. Dorsi/sfondi con contenuto reale (`golden`,
   * `golden-fabric`, `felt-fabric`, `arcane`...) risolvono il nome da collection.cardBackCatalog/
   * backgroundCatalog.*.name — stessa chiave usata dalla pagina Collezione, un solo posto dove
   * sono definiti questi nomi. I titoli con contenuto reale mostrano tutte le forme disponibili
   * (v. TranslationService.titleForms) separate da "/": qui è solo un'anteprima della ricompensa,
   * non una scelta — quale forma equipaggiare si decide nella dialog profilo. Più ricompense sullo
   * stesso obiettivo sono separate da "+". */
  protected readonly rewardLabel = computed(() =>
    this.objective()
      .rewards.map((reward) => this.singleRewardLabel(reward))
      .join(' + '),
  );

  private singleRewardLabel(reward: ObjectiveReward): string {
    if (reward.id.startsWith('TODO_')) return this.i18n.t('objectives.rewardPending');
    if (reward.type === 'cardBack') return this.i18n.t(`collection.cardBackCatalog.${reward.id}.name`);
    if (reward.type === 'background') return this.i18n.t(`collection.backgroundCatalog.${reward.id}.name`);
    if (reward.type === 'title') {
      const forms = this.i18n.titleForms(reward.id);
      if (forms.length > 0) return forms.join(' / ');
    }
    return this.i18n.t('objectives.rewardPending');
  }
}
