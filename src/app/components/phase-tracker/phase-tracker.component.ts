import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { TURN_PHASES, type TurnPhase } from '../../models/turn-phase.model';
import { firstNameOf } from '../../models/player.model';
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

  /** Name of whichever player's turn it currently is — the label itself ("Turno di: {name}") is composed here. */
  readonly turnPlayerName = input.required<string>();
  readonly phase = input.required<TurnPhase>();
  /** Whether the manual "Prosegui" action is currently valid — disables (not hides) the button otherwise, since most phases will end up auto-advancing on their own. */
  readonly canAdvance = input<boolean>(false);

  readonly advance = output<void>();

  protected readonly phases = TURN_PHASES;
  protected readonly turnLabel = computed(() =>
    this.i18n.t('phaseTracker.turnLabel', { name: firstNameOf(this.turnPlayerName()) }),
  );
  private readonly currentIndex = computed(() => TURN_PHASES.indexOf(this.phase()));

  protected stepState(p: TurnPhase): StepState {
    const index = TURN_PHASES.indexOf(p);
    if (index === this.currentIndex()) return 'active';
    return index < this.currentIndex() ? 'done' : 'future';
  }
}
