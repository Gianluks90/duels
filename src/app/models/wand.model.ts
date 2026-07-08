import type { BaseElement } from './element.model';
import type { Card } from './card.model';

/**
 * Cardinal element opposites, used by the body socket mechanic:
 * socketing an element grants protection from it and vulnerability to its opposite.
 */
export const ELEMENT_OPPOSITES: Record<BaseElement, BaseElement> = {
  fire:  'water',
  water: 'fire',
  air:   'earth',
  earth: 'air',
};

/**
 * A player's wand configuration.
 * - handleSocket / bodySocket: chosen once at setup, permanent for the entire game.
 * - tipSlot: temporary (regolamento 1.4.1) — holds one base-tier hand card, usable as if still in
 *   hand during the player's next turn; consumed (not discarded — goes to the common deck's
 *   discard, see PlayerState.tipCardPlacedTurn) if still unused by the end of that turn.
 */
export interface Wand {
  handleSocket: BaseElement | null;
  bodySocket:   BaseElement | null;
  tipSlot:      Card | null;
}
