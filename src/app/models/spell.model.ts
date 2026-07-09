import type { BaseElement, Element } from './element.model';

export type SpellEffectType =
  | 'damage'
  | 'damage_ignore_shields'
  | 'damage_self'
  | 'damage_halve_opponent'
  | 'damage_from_fonte'
  | 'heal'
  | 'shield_add'
  | 'shield_remove_opponent'
  | 'ice_add'
  | 'ice_clear_self'
  | 'poison_add'
  | 'poison_clear_self'
  | 'opponent_discard_random'
  | 'opponent_discard_hand'
  | 'opponent_skip_collect'
  | 'reveal_opponent_hand'
  | 'element_immunity'
  | 'fonte_reset';

export interface SpellEffect {
  type: SpellEffectType;
  amount?: number;
}

/** name/flavorText live in the i18n dictionaries under spells.<id>.name / spells.<id>.flavorText, not here. */
export interface Spell {
  id: string;
  formula: Element[];
  manaCost: number;
  effects: SpellEffect[];
  /** Elemento base di appartenenza della magia (regolamento 1.4.2) — determina se l'asta di chi la subisce dà resistenza/vulnerabilità sul danno inflitto. Assente per gli incantesimi "neutri" che non appartengono a nessun elemento (es. starter_bolt/starter_balm). */
  element?: BaseElement;
}
