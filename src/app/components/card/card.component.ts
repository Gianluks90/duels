import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { Element } from '../../models/element.model';
import { elementImagePath, elementIconPath } from '../../models/element.model';
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
      <img class="card__icon" [ngSrc]="iconSrc()" alt="" aria-hidden="true" fill />
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
  /** Shows a compact icon+name header instead of the centered icon overlay — for when the card is mostly hidden behind another element and only an edge peeks out. */
  readonly header = input<boolean>(false);
  /** Which edge the header bar is pinned to. */
  readonly headerAlign = input<'top' | 'bottom'>('top');

  protected readonly height = computed(() => Math.round(this.size() * 1.5));
  protected readonly radius = computed(() => Math.min(Math.round(this.size() * 0.09), 10));
  protected readonly artSrc = computed(() => elementImagePath(this.element()));
  protected readonly iconSrc = computed(() => elementIconPath(this.element()));
  protected readonly label = computed(() => this.i18n.elementLabel(this.element()));
}
