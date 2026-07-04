import type { BaseElement } from './element.model';

/** Mana provided by each wand piece (uniform in the base game). */
export const WAND_PIECE_MANA = 2;

/** Total starting mana pool: 3 pieces × 2 each. */
export const BASE_TOTAL_MANA = WAND_PIECE_MANA * 3;

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
 * - tipSlot: temporary; holds one element available for next turn, discarded if unused.
 */
export interface Wand {
  handleSocket: BaseElement | null;
  bodySocket:   BaseElement | null;
  tipSlot:      BaseElement | null;
}
