import type { BaseElement } from './element.model';
import type { Card } from './card.model';
import type { Wand } from './wand.model';

export type PlayerId = 'p1' | 'p2';
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
  hp: number;           // sfere rosse rimaste (guaribili), parte da 10
  curseSlots: number;   // slot permanenti da danno non curabile, parte da 0
                        // maxHp guaribile = 10 - curseSlots

  // Mana
  mana: number;         // mana corrente
  maxMana: number;      // somma dei manaBonus dei tre pezzi della bacchetta

  // Carte
  hand: Card[];         // max 5
  deck: Card[];
  discards: Card[];

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
