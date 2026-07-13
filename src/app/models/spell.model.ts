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
  | 'reveal_opponent_hand'
  // Rimandato a una futura espansione "Status e magie continue" (12/07/2026): richiede un vero
  // sistema di stati a scadenza sul giocatore, non ancora esistente — tenuto nell'unione come
  // promemoria di design, ma nessuno SpellEffect lo usa oggi (vedi README, punto 1).
  | 'element_immunity'
  | 'fonte_reset'
  | 'boost_card_mana';

export interface SpellEffect {
  type: SpellEffectType;
  amount?: number;
}

/** SpellEffectType che richiedono una carta bersaglio scelta dal giocatore al momento del lancio (castSpell), non un target cablato come per gli altri effetti (avversario/sé stesso/casuale) — usata sia da CastSpellDialogComponent (per sapere se mostrare il selettore) sia da castSpell in turn-engine.ts (per validare che sia stato scelto). */
export const TARGET_CARD_EFFECT_TYPES: readonly SpellEffectType[] = ['boost_card_mana'];

/** name/flavorText live in the i18n dictionaries under spells.<id>.name / spells.<id>.flavorText, not here. */
export interface Spell {
  id: string;
  formula: Element[];
  manaCost: number;
  effects: SpellEffect[];
  /** Elemento base di appartenenza della magia (regolamento 1.4.2) — determina se l'asta di chi la subisce dà resistenza/vulnerabilità sul danno inflitto. Assente per gli incantesimi "neutri" che non appartengono a nessun elemento (es. starter_bolt/starter_balm). */
  element?: BaseElement;
}
