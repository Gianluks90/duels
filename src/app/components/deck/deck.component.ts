import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CardComponent } from '../card/card.component';
import type { Element } from '../../models/element.model';

/** Deterministic rotation angles for the messy discard-pile look, cycled by index — not Math.random(), so cards don't jitter on every change-detection run. */
const MESSY_ROTATIONS = [-7, 5, -4, 6, -3];
/** Max number of card layers rendered for a messy pile, regardless of the real count. */
const MESSY_STACK_SIZE = 3;

/**
 * A deck or a discard pile — the same thing, really: a discard is just a deck
 * that's always faceUp. faceUp shows the real topElement art instead of a
 * generic back; messy scatters a few rotated layers for a tossed-pile look.
 */
@Component({
  selector: 'app-deck',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    @if (count() > 0) {
      @if (!messy()) {
        @if (faceUp() && topElement(); as el) {
          <app-card [element]="el" [size]="size()" />
        } @else {
          <div class="deck__back deck__back--stacked" [style.width.px]="size()" [style.height.px]="height()" aria-hidden="true"></div>
        }
      } @else {
        <div class="deck__stack" [style.width.px]="size()" [style.height.px]="height()">
          @for (i of backSlots(); track i) {
            <div class="deck__back deck__back--layer" [style.transform]="rotation(i)" aria-hidden="true"></div>
          }
          @if (faceUp() && topElement(); as el) {
            <app-card class="deck__top" [element]="el" [size]="size()" [style.transform]="rotation(backSlots().length)" />
          } @else {
            <div class="deck__back deck__back--layer" [style.transform]="rotation(backSlots().length)" aria-hidden="true"></div>
          }
        </div>
      }
    }

    @if (showLabel() || showCount()) {
      <div class="deck__info">
        @if (showLabel() && label(); as l) {
          <span class="deck__label">{{ l }}</span>
        }
        @if (showCount()) {
          <span class="deck__count">{{ count() }}</span>
        }
      </div>
    }
  `,
  styleUrl: './deck.component.scss',
})
export class DeckComponent {
  /** Card width in px; height follows the standard 2:3 ratio. */
  readonly size = input<number>(76);
  readonly count = input<number>(0);
  /** Shows the real element art on top instead of a generic back — a discard pile is just a deck that's always face up. */
  readonly faceUp = input<boolean>(false);
  /** The element shown on top when faceUp — typically the last card drawn or discarded. */
  readonly topElement = input<Element | null>(null);
  /** Renders as a small, slightly scattered heap (a few rotated layers) instead of one neat stacked card — for discard piles. */
  readonly messy = input<boolean>(false);
  readonly label = input<string | null>(null);
  readonly showLabel = input<boolean>(true);
  readonly showCount = input<boolean>(true);

  protected readonly height = computed(() => Math.round(this.size() * 1.5));

  protected readonly backSlots = computed(() => {
    if (!this.messy() || this.count() <= 0) return [];
    const behindTop = Math.min(this.count() - 1, MESSY_STACK_SIZE - 1);
    return Array.from({ length: Math.max(behindTop, 0) }, (_, i) => i);
  });

  protected rotation(index: number): string {
    return `rotate(${MESSY_ROTATIONS[index % MESSY_ROTATIONS.length]}deg)`;
  }
}
