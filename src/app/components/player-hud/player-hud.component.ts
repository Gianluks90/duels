import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { TURN_PHASES, turnPhaseLabel, turnPhaseDescription, type TurnPhase } from '../../models/turn-phase.model';
import type { Health } from '../../models/player.model';
import { TooltipDirective } from '../ui/tooltip/tooltip.directive';

@Component({
  selector: 'app-player-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  templateUrl: './player-hud.component.html',
  styleUrl: './player-hud.component.scss',
})
export class PlayerHudComponent {
  readonly name      = input.required<string>();
  readonly health    = input.required<Health>();
  readonly mana      = input.required<number>();
  readonly maxMana   = input.required<number>();
  readonly isMyTurn  = input<boolean>(false);
  /** The current turn's phase — only actually highlighted when isMyTurn(), since the other player has no "current phase" of their own. */
  readonly phase     = input<TurnPhase>('raccolta');
  readonly mirrored  = input<boolean>(false);
  readonly width     = input<number>(264);

  /** Only rendered when !mirrored() — the opponent's panel has no settings button. */
  readonly settingsClick = output<void>();

  protected readonly phases = TURN_PHASES;
  protected readonly turnPhaseLabel = turnPhaseLabel;
  protected readonly turnPhaseDescription = turnPhaseDescription;

  protected readonly firstName = computed(() => {
    const full = this.name();
    const idx = full.indexOf(' ');
    return idx > 0 ? full.slice(0, idx) : full;
  });

  /** Normally == max, so the bar behaves exactly as before; only stretches when shield pushes the total past max, so the shield segment is never clipped. */
  private readonly totalUnits = computed(() => Math.max(this.health().max, this.health().current + this.health().shield));

  protected readonly hpPercent = computed(() => this.percentOf(this.health().current));
  protected readonly shieldPercent = computed(() => this.percentOf(this.health().shield));
  protected readonly hasShield = computed(() => this.health().shield > 0);

  /** The number shown above the bar merges current + shield — the tooltip (only present when there's a shield) spells out the breakdown. */
  protected readonly displayedHp = computed(() => this.health().current + this.health().shield);

  protected readonly hpTooltip = computed(() => {
    const { current, shield } = this.health();
    return shield > 0 ? `Punti vita: ${current} + ${shield} = ${current + shield}` : null;
  });

  private percentOf(value: number): number {
    const pct = (value / this.totalUnits()) * 100;
    return Math.max(0, Math.min(100, pct));
  }
}
