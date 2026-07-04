import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';

@Component({
  selector: 'app-player-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-hud.component.html',
  styleUrl: './player-hud.component.scss',
})
export class PlayerHudComponent {
  readonly name      = input.required<string>();
  readonly hp        = input.required<number>();
  readonly maxHp     = input<number>(20);
  readonly mana      = input.required<number>();
  readonly maxMana   = input.required<number>();
  readonly isMyTurn  = input<boolean>(false);
  readonly mirrored  = input<boolean>(false);
  readonly width     = input<number>(264);

  protected readonly firstName = computed(() => {
    const full = this.name();
    const idx = full.indexOf(' ');
    return idx > 0 ? full.slice(0, idx) : full;
  });

  protected readonly hpPercent = computed(() => {
    const pct = (this.hp() / this.maxHp()) * 100;
    return Math.max(0, Math.min(100, pct));
  });
}
