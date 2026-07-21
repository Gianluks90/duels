import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { TURN_PHASES, type TurnPhase } from '../../models/turn-phase.model';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TooltipDirective } from '../ui/tooltip/tooltip.directive';

/** One node's visual state along the 6-phase line — 'done' and 'attesa' itself are always 'done', since it's never the real persisted phase (turn-phase.model.ts). */
type StepState = 'done' | 'active' | 'future';

@Component({
  selector: 'app-phase-tracker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, TooltipDirective],
  templateUrl: './phase-tracker.component.html',
  styleUrl: './phase-tracker.component.scss',
})
export class PhaseTrackerComponent {
  protected readonly i18n = inject(TranslationService);

  /** Numero di turno progressivo (GameState.turnNumber, parte da 1) — la label ("Turno {number}") è composta qui. */
  readonly turnNumber = input.required<number>();
  readonly phase = input.required<TurnPhase>();
  /** Whether the manual "Prosegui" action is currently valid — disables (not hides) the button otherwise, since most phases will end up auto-advancing on their own. */
  readonly canAdvance = input<boolean>(false);
  /** Incantesimi in coda del giocatore di turno (5.2), non ancora risolti — un puntino dorato lampeggiante per ciascuno, sotto la label della fase Incantesimo. */
  readonly pendingSpellsCount = input<number>(0);

  readonly advance = output<void>();

  protected readonly pendingSpellsRange = computed(() => Array.from({ length: this.pendingSpellsCount() }, (_, i) => i));

  /** 'attesa' esclusa dalla UI: ora che c'è un unico tracker condiviso (non uno per pannello), mostrare
   *  un pallino sempre "fatto" per una fase che non è mai quella attiva non aggiunge informazione —
   *  il turno mostrato parte da Preparazione. Resta comunque il primo valore in TURN_PHASES lato logica. */
  protected readonly phases: readonly TurnPhase[] = TURN_PHASES.filter(p => p !== 'attesa');
  protected readonly turnLabel = computed(() =>
    this.i18n.t('phaseTracker.turnLabel', { number: this.turnNumber() }),
  );
  private readonly currentIndex = computed(() => this.phases.indexOf(this.phase()));

  protected stepState(p: TurnPhase): StepState {
    const index = this.phases.indexOf(p);
    if (index === this.currentIndex()) return 'active';
    return index < this.currentIndex() ? 'done' : 'future';
  }
}
