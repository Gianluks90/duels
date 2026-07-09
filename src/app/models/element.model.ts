export type BaseElement = 'fire' | 'water' | 'air' | 'earth';
export type AdvancedElement = 'thunder' | 'poison' | 'ice' | 'lava';
export type SuperiorElement = 'light' | 'dark';
/** 'residium' (Residuo Arcano, 2.5) e 'mana' (mana accumulato in Raccolta, non un vero elemento — carta tier 'mana', mai spendibile in una combinazione) sono pseudo-elementi: servono solo perché Card.element richiede comunque un Element valido per arte/icona/valore mana. */
export type Element = BaseElement | AdvancedElement | SuperiorElement | 'residium' | 'mana';

export const ADVANCED_RECIPES: Record<AdvancedElement, [BaseElement, BaseElement]> = {
  thunder: ['fire', 'air'],
  poison:  ['water', 'earth'],
  ice:     ['water', 'air'],
  lava:    ['fire', 'earth'],
};

export const SUPERIOR_FORMULA: BaseElement[] = ['fire', 'water', 'air', 'earth'];

/** Mana value of each element — base elements are worth 1, advanced/superior 2, Residuo Arcano 0 (regolamento v2, 2.2/2.3/2.4/2.5); mana accumulato (Raccolta) vale 1, come una base, ma non è spendibile in nessuna combinazione (nessun helper di combinazione riconosce tier 'mana'). */
export const ELEMENT_MANA: Record<Element, number> = {
  fire: 1,
  water: 1,
  air: 1,
  earth: 1,
  thunder: 2,
  poison: 2,
  ice: 2,
  lava: 2,
  light: 2,
  dark: 2,
  residium: 0,
  mana: 1,
};

export function elementImagePath(element: Element): string {
  return `/cards/${element}.png`;
}

const ELEMENT_ICONS: Record<Element, string> = {
  fire:    '/icons/local_fire_department_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  water:   '/icons/water_drop_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  air:     '/icons/air_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  earth:   '/icons/eco_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  thunder: '/icons/bolt_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  ice:     '/icons/mode_cool_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  poison:  '/icons/skull_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  lava:    '/icons/heat_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  light:   '/icons/sunny_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  dark:    '/icons/dark_mode_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  residium:'/icons/diamond_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg',
  mana:    '/icons/diamond_shine_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg',
};

export function elementIconPath(element: Element): string {
  return ELEMENT_ICONS[element];
}
