import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { Element } from '../../models/element.model';
import { elementImagePath, elementIconPath, ELEMENT_MANA } from '../../models/element.model';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  template: `
    <img class="card__art" [ngSrc]="artSrc()" [alt]="label()" [priority]="priority()" fill />
    @if (header()) {
      <div class="card__header">
        <img class="card__header-icon" [src]="iconSrc()" alt="" aria-hidden="true" />
        <span class="card__header-label">{{ label() }}</span>
      </div>
    } @else {
      @if (showMana() && manaValue() > 0) {
        <span class="card__badge card__badge--mana" [attr.aria-label]="manaAria()">{{ manaValue() }}</span>
      }
      <img class="card__badge card__badge--element" [src]="iconSrc()" alt="" aria-hidden="true" />
    }
  `,
  styleUrl: './card.component.scss',
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'height()',
    '[style.border-radius.px]': 'radius()',
    '[class.card--header-bottom]': "headerAlign() === 'bottom'",
  },
})
export class CardComponent {
  private readonly i18n = inject(TranslationService);

  readonly element = input.required<Element>();
  /** Card width in px. Height derives from the 2:3 portrait ratio. */
  readonly size = input<number>(40);
  /** Set on whichever card instance is expected to be the LCP element (e.g. the first hand card) — disables lazy loading and hints the browser to fetch it eagerly. */
  readonly priority = input<boolean>(false);
  /** Shows a compact icon+name header instead of the corner badges — for when the card is mostly hidden behind another element and only an edge peeks out. */
  readonly header = input<boolean>(false);
  /** Which edge the header bar is pinned to. */
  readonly headerAlign = input<'top' | 'bottom'>('top');
  /** Hides the Mana corner badge — for contexts where the card is rendered too small for it, or the cost is already shown elsewhere (e.g. the grimoire's formula cards). */
  readonly showMana = input<boolean>(true);
  /** Bonus manico (regolamento 1.4.3) permanently carried by this card instance — added on top of the element's base mana value. */
  readonly manaBonus = input<number>(0);

  protected readonly height = computed(() => Math.round(this.size() * 1.5));
  protected readonly radius = computed(() => Math.min(Math.round(this.size() * 0.09), 10));
  protected readonly artSrc = computed(() => elementImagePath(this.element()));
  protected readonly iconSrc = computed(() => elementIconPath(this.element()));
  protected readonly label = computed(() => this.i18n.elementLabel(this.element()));
  protected readonly manaValue = computed(() => ELEMENT_MANA[this.element()] + this.manaBonus());
  protected readonly manaAria = computed(() => this.i18n.t('card.manaAria', { value: this.manaValue() }));
}
