import type { BaseElement } from './element.model';
import { ELEMENT_MANA } from './element.model';
import type { Card } from './card.model';
import type { Wand } from './wand.model';

export type PlayerId = 'host' | 'guest';
export type CardBackSkin = 'dark' | 'light';

export interface PlayerTokens {
  shield: number;  // 0–3
  poison: number;  // 0–3
  ice: number;     // 0–3
}

/** The vita bar's shape: current/max hp plus bonus effective hp from shield tokens (PlayerTokens.shield, 0–3). */
export interface Health {
  max: number;
  current: number;
  shield: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  wand: Wand;

  // Vita
  hp: number;           // Punti Salute correnti, parte da 20 (regolamento v2, 1.3)

  // Carte
  hand: Card[];         // max 5
  deck: Card[];
  discards: Card[];
  /** Le 2 carte pescate in fase Raccolta, in attesa che il giocatore scelga quale tenere (regolamento 4.3). Persistito — non un semplice stato locale — così la scelta sopravvive a un mazzo appena rimescolato. */
  pendingCollect: [Card, Card] | null;

  // Segnalini
  tokens: PlayerTokens;

  // Preferenze
  cardBack: CardBackSkin;

  // Flag di turno (si azzerano a ogni turno)
  hasCollectedThisTurn: boolean;
  hasUsedWandAbility: boolean;
  spellsPlayedThisTurn: number;    // per Corpo Metallico

  // Flag di partita
  puntaSpellUsed: boolean;

  // Effetti attivi
  handRevealed: boolean;               // Occhio del Sole
  immuneToElement: BaseElement | null; // Abbraccio Radiante
}

/** Il mana non è un pool salvato: è la somma del valore delle carte in mano in quel momento (regolamento v2, 3.1). */
export function computePlayerMana(hand: readonly Card[]): number {
  return hand.reduce((sum, card) => {
    if (card.tier === 'freeze') return sum; // non-carta (2.3.1): nessun valore di mana
    return sum + ELEMENT_MANA[card.element] + (card.manaBonus ?? 0);
  }, 0);
}

/** Solo il primo nome (split sul primo spazio) — usato ovunque un nome visualizzato debba restare compatto (HUD, tracker di fase). */
export function firstNameOf(fullName: string): string {
  const idx = fullName.indexOf(' ');
  return idx > 0 ? fullName.slice(0, idx) : fullName;
}
