import type { BaseElement } from './element.model';

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
