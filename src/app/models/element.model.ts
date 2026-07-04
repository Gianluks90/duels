export type BaseElement = 'fire' | 'water' | 'air' | 'earth';
export type AdvancedElement = 'thunder' | 'poison' | 'ice' | 'lava';
export type SuperiorElement = 'light' | 'dark';
export type Element = BaseElement | AdvancedElement | SuperiorElement | 'residium';

export const ADVANCED_RECIPES: Record<AdvancedElement, [BaseElement, BaseElement]> = {
  thunder: ['fire', 'air'],
  poison:  ['water', 'earth'],
  ice:     ['water', 'air'],
  lava:    ['fire', 'earth'],
};

export const SUPERIOR_FORMULA: BaseElement[] = ['fire', 'water', 'air', 'earth'];

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
};

export function elementIconPath(element: Element): string {
  return ELEMENT_ICONS[element];
}

const ELEMENT_LABELS: Record<Element, string> = {
  fire: 'Fuoco', water: 'Acqua', air: 'Aria', earth: 'Terra',
  thunder: 'Tuono', poison: 'Veleno', ice: 'Ghiaccio', lava: 'Lava',
  light: 'Luce', dark: 'Oscurità', residium: 'Residuo',
};

export function elementLabel(element: Element): string {
  return ELEMENT_LABELS[element];
}
