import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { Objective } from '../../models/objective.model';
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
      <span class="objective-card__name">{{ objectiveName() }}</span>
      <p class="objective-card__label t-muted">{{ objectiveDescription() }}</p>
      <div class="objective-card__info">
        <span class="objective-card__count t-muted"
          >{{ displayProgress() }} / {{ objective().threshold }}</span
        >
      </div>
      <div
        class="objective-card__track"
        role="progressbar"
        [attr.aria-valuenow]="displayProgress()"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="objective().threshold"
        [attr.aria-label]="objectiveDescription()"
      >
        <div class="objective-card__fill" [style.width.%]="percent()"></div>
      </div>
      <div class="objective-card__footer">
        <span class="objective-card__reward t-muted">{{ rewardLabel() }}</span>
        @if (completed() && !claimed()) {
          <button
            type="button"
            class="btn btn--primary objective-card__claim"
            (click)="claim.emit(objective().id)"
          >
            {{ 'objectives.claim' | translate }}
          </button>
        } @else if (claimed()) {
          <span class="objective-card__claimed-badge"
            >✓ {{ 'objectives.claimed' | translate }}</span
          >
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
  /** Nome "da trofeo" dell'obiettivo (v. documentation/achievement-titles.md) — chiave separata da
   * objectiveDescription sotto: qui il titolo, là la condizione scritta per il giocatore, mostrati
   * entrambi insieme sulla card. */
  protected readonly objectiveName = computed(() =>
    this.i18n.t(`objectives.names.${this.objective().id}`),
  );
  /** Condizione di sblocco scritta per il giocatore (v. documentation/achievement-titles.md,
   * colonna "Metrica · Soglia" aggiornata con testo discorsivo) — sostituisce la vecchia
   * `objectives.metricLabels.<metric> · <soglia>` ("Vittorie · 10"): una chiave per OBIETTIVO, non
   * per metrica, perché due obiettivi sulla stessa metrica (es. win_10/win_50) hanno soglie e toni
   * diversi ("Colleziona 10 vittorie" vs "Colleziona 50 vittorie"). Le voci `objectives.
   * metricLabels.*` restano nei dizionari ma non sono più lette da nessun componente. */
  protected readonly objectiveDescription = computed(() =>
    this.i18n.t(`objectives.descriptions.${this.objective().id}`),
  );
  /** La maggior parte dei reward sono ancora placeholder ('TODO_...', v. data/objectives.ts) — mai
   * mostrati grezzi, solo l'etichetta neutra, senza il prefisso di categoria (non c'è ancora un nome
   * vero da annunciare). Dorsi/sfondi con contenuto reale (`golden`, `golden-fabric`, `felt-fabric`,
   * `arcane`...) risolvono il nome da collection.cardBackCatalog/backgroundCatalog.*.name — stessa
   * chiave usata dalla pagina Collezione, un solo posto dove sono definiti questi nomi. I titoli con
   * contenuto reale mostrano tutte le forme disponibili (v. TranslationService.titleForms) separate
   * da "/": qui è solo un'anteprima della ricompensa, non una scelta — quale forma equipaggiare si
   * decide nella dialog profilo. Le varianti elemento risolvono "Elemento <Nome>"
   * (objectives.elementVariantName + TranslationService.elementLabel, mai una traduzione dedicata
   * per ciascun elemento — riusa common.elements.<id> già esistente). Ogni reward risolto è preceduto
   * dalla sua categoria tra virgolette (es. `Sfondo "Dorato"`, objectives.rewardTypeLabels.<type>)
   * così il giocatore capisce cosa sta per ottenere senza dover aprire la Collezione. Più ricompense
   * sullo stesso obiettivo sono unite come un elenco in linguaggio naturale ("A, B e C",
   * objectives.rewardConjunction per l'ultima congiunzione) invece che con un semplice "+". */
  protected readonly rewardLabel = computed(() =>
    this.i18n.joinWithConjunction(
      this.objective().rewards.map((reward) => this.i18n.rewardLabel(reward)),
    ),
  );
}
