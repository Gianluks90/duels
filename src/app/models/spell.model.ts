import type { BaseElement, Element } from './element.model';
import type { CardTier } from './card.model';

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
  | 'boost_card_mana'
  | 'consume_discards';

export interface SpellEffect {
  type: SpellEffectType;
  amount?: number;
  /** Solo per 'reveal_opponent_hand': se presente, il pescaggio casuale del bersaglio è ristretto alle sole carte di questo tier (es. 'spell', per rivelare specificamente una magia in mano invece di una carta qualunque) — assente per un pescaggio libero su tutta la mano, come third_eye/supreme_eye. */
  cardTierFilter?: CardTier;
  /** Solo per 'consume_discards' (MULTI_TARGET_CARD_EFFECT_TYPES): quali tier di carta sono selezionabili come bersaglio nei propri scarti, oltre al default (DEFAULT_CONSUMABLE_CARD_TIERS, solo elementi veri). Una versione più forte dello stesso effetto (es. 'destroy', "Distruggere") allarga il pool includendo 'spell'/'freeze' — carte che non appartengono a nessun mazzo comune/avanzato, quindi "consumarle" le fa sparire dal gioco invece di tornare negli scarti condivisi (vedi applyConsumeDiscards in turn-engine.ts). Pensato per restare aperto: un futuro tier "effetto" diverso da 'freeze' ci rientra aggiungendolo qui, senza toccare il motore. */
  consumableCardTiers?: readonly CardTier[];
}

/** SpellEffectType che richiedono una carta bersaglio scelta dal giocatore al momento del lancio (castSpell), non un target cablato come per gli altri effetti (avversario/sé stesso/casuale) — usata sia da CastSpellDialogComponent (per sapere se mostrare il selettore) sia da castSpell in turn-engine.ts (per validare che sia stato scelto). Il bersaglio si sceglie tra le carte nei PROPRI scarti, non in mano (boost_card_mana/improve_mana, 14/07/2026) — se gli scarti sono vuoti la scelta è saltata, non bloccante. */
export const TARGET_CARD_EFFECT_TYPES: readonly SpellEffectType[] = ['boost_card_mana'];

/** SpellEffectType con bersagli scelti dal giocatore ma in numero VARIABILE (0..effect.amount), a differenza di TARGET_CARD_EFFECT_TYPES sopra dove la scelta è di una sola carta ed è obbligatoria se esistono candidati (es. 'consume_discards', "Sciogliere"/"Distruggere": fino a 2 carte dai propri scarti, 0 sempre valido). Il pool di carte eleggibili varia per magia (SpellEffect.consumableCardTiers, default DEFAULT_CONSUMABLE_CARD_TIERS) ma il comportamento non bloccante a scarti vuoti è sempre lo stesso — vedi castSpell/applyConsumeDiscards in turn-engine.ts e CastSpellDialogComponent. */
export const MULTI_TARGET_CARD_EFFECT_TYPES: readonly SpellEffectType[] = ['consume_discards'];

/** Tier eleggibili di default per gli effetti in MULTI_TARGET_CARD_EFFECT_TYPES quando SpellEffect.consumableCardTiers è assente (es. 'dissolve', "Sciogliere"): solo elementi veri — le uniche carte con un mazzo comune/avanzato a cui tornare quando consumate. Residuo/mana accumulato restano sempre esclusi (2.5: il Residuo "non è un elemento"; il mana accumulato non finisce mai negli scarti). */
export const DEFAULT_CONSUMABLE_CARD_TIERS: readonly CardTier[] = ['base', 'advanced', 'superior'];

/** name/flavorText live in the i18n dictionaries under spells.<id>.name / spells.<id>.flavorText, not here. */
export interface Spell {
  id: string;
  formula: Element[];
  manaCost: number;
  effects: SpellEffect[];
  /** Elemento base di appartenenza della magia (regolamento 1.4.2) — determina se l'asta di chi la subisce dà resistenza/vulnerabilità sul danno inflitto. Assente per gli incantesimi "neutri" che non appartengono a nessun elemento (es. starter_bolt/starter_balm). */
  element?: BaseElement;
}
