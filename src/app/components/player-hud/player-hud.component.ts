import { Component, ChangeDetectionStrategy, computed, input, output, inject } from '@angular/core';
import { firstNameOf, type Health } from '../../models/player.model';
import { elementIconPath } from '../../models/element.model';
import { TooltipDirective } from '../ui/tooltip/tooltip.directive';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-player-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective, TranslatePipe],
  templateUrl: './player-hud.component.html',
  styleUrl: './player-hud.component.scss',
})
export class PlayerHudComponent {
  protected readonly i18n = inject(TranslationService);

  readonly name      = input.required<string>();
  readonly health    = input.required<Health>();
  readonly mirrored  = input<boolean>(false);
  readonly width     = input<number>(264);
  /** Google account photo (GameDoc.hostPhoto/guestPhoto) — null shows the name's initial instead, same fallback as the home page avatar. */
  readonly photoUrl  = input<string | null>(null);
  /** Livello di Avvelenamento (0–3, regolamento 2.3.4) — un teschio per livello, accanto al valore di vita. */
  readonly poisonLevel = input<number>(0);
  /** true finché il giocatore ha ancora carte Congelamento non sciolte in circolazione (mano, mazzo o scarti — regolamento 2.3.1). */
  readonly frozen = input<boolean>(false);

  /** Only rendered when !mirrored() — the opponent's panel has no settings button. */
  readonly settingsClick = output<void>();

  protected readonly poisonIcon = elementIconPath('poison');
  protected readonly poisonRange = computed(() => Array.from({ length: this.poisonLevel() }, (_, i) => i));
  protected readonly isPoisoned = computed(() => this.poisonLevel() > 0);

  protected readonly firstName = computed(() => firstNameOf(this.name()));
  protected readonly avatarInitial = computed(() => (this.name().charAt(0) || '?').toUpperCase());

  /** Normally == max, so the bar behaves exactly as before; only stretches when shield pushes the total past max, so the shield segment is never clipped. */
  private readonly totalUnits = computed(() => Math.max(this.health().max, this.health().current + this.health().shield));

  protected readonly hpPercent = computed(() => this.percentOf(this.health().current));
  protected readonly shieldPercent = computed(() => this.percentOf(this.health().shield));
  protected readonly hasShield = computed(() => this.health().shield > 0);

  /** The number shown above the bar merges current + shield — the tooltip (only present when there's a shield) spells out the breakdown. */
  protected readonly displayedHp = computed(() => this.health().current + this.health().shield);

  protected readonly hpAria = computed(() =>
    this.i18n.t('playerHud.hpAria', { name: this.firstName(), value: this.displayedHp(), max: this.health().max }),
  );

  protected readonly poisonAria = computed(() => this.i18n.t('playerHud.poisonAria', { level: this.poisonLevel() }));
  protected readonly frozenAria = computed(() => this.i18n.t('playerHud.frozenAria'));

  protected readonly hpTooltip = computed(() => {
    const { current, shield } = this.health();
    return shield > 0 ? this.i18n.t('playerHud.hpTooltip', { current, shield, total: current + shield }) : null;
  });

  private percentOf(value: number): number {
    const pct = (value / this.totalUnits()) * 100;
    return Math.max(0, Math.min(100, pct));
  }
}
