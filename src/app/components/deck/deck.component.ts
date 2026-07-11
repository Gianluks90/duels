import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CardComponent } from '../card/card.component';
import type { Element } from '../../models/element.model';
import type { SpecialMana } from '../../models/card.model';

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
          <app-card
            [element]="el"
            [manaBonus]="topManaBonus()"
            [specialMana]="topSpecialMana()"
            [showMana]="!topFreeze()"
            [freeze]="topFreeze()"
            [size]="size()"
          />
        } @else {
          <div
            class="deck__back deck__back--stacked"
            [class.deck__back--no-border]="!showBorder()"
            [style.width.px]="size()"
            [style.height.px]="height()"
            aria-hidden="true"
          ></div>
        }
      } @else {
        <div class="deck__stack" [style.width.px]="size()" [style.height.px]="height()">
          @for (i of backSlots(); track i) {
            <div
              class="deck__back deck__back--layer"
              [style.transform]="rotation(i)"
              aria-hidden="true"
            ></div>
          }
          @if (faceUp() && topElement(); as el) {
            <app-card
              class="deck__top"
              [element]="el"
              [manaBonus]="topManaBonus()"
              [specialMana]="topSpecialMana()"
              [showMana]="!topFreeze()"
              [freeze]="topFreeze()"
              [size]="size()"
              [style.transform]="rotation(backSlots().length)"
            />
          } @else {
            <div
              class="deck__back deck__back--layer"
              [style.transform]="rotation(backSlots().length)"
              aria-hidden="true"
            ></div>
          }
        </div>
      }
    } @else if (emptyPlaceholder() === 'boxed') {
      <!-- Spazio "fisico" per la pila vuota, invece del vuoto anonimo di prima — un riquadro vuoto
           delle stesse dimensioni di una carta; label/conteggio restano nel .deck__info sotto,
           come per "Base"/"Avanzato", così tutto si allinea sulla stessa riga. -->
      <div
        class="deck__empty deck__empty--boxed"
        [style.width.px]="size()"
        [style.height.px]="height()"
      ></div>
    } @else if (emptyPlaceholder() === 'boxed-text') {
      <!-- Come 'boxed', ma senza un .deck__info a parte a cui appoggiarsi (showLabel/showCount qui
           sono false) — testo centrato dentro il riquadro stesso, anche se il riquadro finisce per
           "uscire" dal contenitore della mano come già fa il mazzo personale. -->
      <div
        class="deck__empty deck__empty--boxed"
        [style.width.px]="size()"
        [style.height.px]="height()"
      >
        @if (label(); as l) {
          <span class="deck__label">{{ l }}</span>
        }
        <span class="deck__count">{{ count() }}</span>
      </div>
    } @else if (emptyPlaceholder() === 'text') {
      <!-- Dove le carte escono già dal bordo del contenitore (mano/scarti del giocatore) un riquadro
           tratteggiato stonerebbe — solo il testo, centrato nello stesso spazio dedicato. -->
      <div class="deck__empty" [style.width.px]="size()" [style.height.px]="height()">
        @if (label(); as l) {
          <span class="deck__label">{{ l }}</span>
        }
        <span class="deck__count">{{ count() }}</span>
      </div>
    }

    @if (
      (showLabel() || showCount()) &&
      emptyPlaceholder() !== 'text' &&
      emptyPlaceholder() !== 'boxed-text'
    ) {
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
  /** Bonus manico (1.4.3) carried by that same top card, if any — without this, a permanently-boosted card would silently show its plain base value the moment it lands on top of a pile. */
  readonly topManaBonus = input<number>(0);
  /** Mana speciale (3.2) carried by that same top card, if any — same reasoning as topManaBonus: without it, a special-mana card silently loses its badge the moment it lands on top of a pile. */
  readonly topSpecialMana = input<SpecialMana | null>(null);
  /** True when that same top card is a Congelamento non-carta (Card.tier 'freeze', regolamento 2.3.1) — without this it would show as a plain 'ice' element card (topElement is just the Element, tier is lost) instead of the freeze token look. */
  readonly topFreeze = input<boolean>(false);
  /** Renders as a small, slightly scattered heap (a few rotated layers) instead of one neat stacked card — for discard piles. */
  readonly messy = input<boolean>(false);
  readonly label = input<string | null>(null);
  readonly showLabel = input<boolean>(true);
  readonly showCount = input<boolean>(true);
  /** When count() is 0: 'boxed' draws an empty dashed placeholder box, label/count rendered below in .deck__info like any other deck (e.g. Fonte Arcana, alongside "Base"/"Avanzato"); 'boxed-text' is the same box but with label/count centered inside it instead, for decks with showLabel/showCount false and thus no .deck__info of their own (the hand box's personal piles); 'text' has no border at all, just centered label/count (currently unused, kept for completeness); null keeps the old blank-space behavior. */
  readonly emptyPlaceholder = input<'boxed' | 'boxed-text' | 'text' | null>(null);
  /** false hides this deck's own static border — for when an external highlight (e.g. a pulsing outline around the whole trigger button) already marks it, so the two don't double up. */
  readonly showBorder = input<boolean>(true);

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
