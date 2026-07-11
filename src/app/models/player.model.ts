import type { BaseElement } from './element.model';
import { ELEMENT_MANA } from './element.model';
import type { Card } from './card.model';
import type { Wand } from './wand.model';

export type PlayerId = 'host' | 'guest';
export type CardBackSkin = 'dark' | 'light';

/** Mana speciale (3.2.2/3.2.3): +1 PS/danno extra per ogni carta vitale/caotica usata per pagare, calcolato al momento del pagamento (castSpell) — le carte di pagamento vengono scartate subito, quindi non sarebbero più consultabili al momento della risoluzione in fase Incantesimo (resolveSpells). 0 se la magia non è stata pagata con quel tipo di mana, o se l'effetto corrispondente (heal per vitale, damage per caotico) non è nemmeno presente nella magia. */
export interface PendingSpell {
  card: Card;
  vitalBonus: number;
  chaoticBonus: number;
}

export interface PlayerTokens {
  shield: number; // 0+, no cap (2.3.3 — unlike poison, the rulebook fixes no ceiling; applyShield in turn-engine.ts)
  poison: number; // 0–3
  ice: number; // 0–3
}

/** The vita bar's shape: current/max hp plus bonus effective hp from shield tokens (PlayerTokens.shield, no cap — see the field's own comment). */
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
  hp: number; // Punti Salute correnti, parte da 20 (regolamento v2, 1.3)

  // Carte
  hand: Card[]; // max 5
  deck: Card[];
  discards: Card[];
  /** Le 2 carte pescate in fase Raccolta, in attesa che il giocatore scelga quale tenere (regolamento 4.3). Persistito — non un semplice stato locale — così la scelta sopravvive a un mazzo appena rimescolato. */
  pendingCollect: [Card, Card] | null;
  /** Le carte incantesimo lanciate in fase Azione, in attesa di risoluzione al passaggio in fase Incantesimo (regolamento 5.2/5.3). Persistito, non locale, per lo stesso motivo di pendingCollect. */
  pendingSpells: PendingSpell[];

  // Segnalini
  tokens: PlayerTokens;

  // Preferenze
  cardBack: CardBackSkin;

  // Flag di turno (si azzerano a ogni turno)
  hasCollectedThisTurn: boolean;
  spellsPlayedThisTurn: number; // per Corpo Metallico

  /** Il turnNumber in cui la carta attualmente in wand.tipSlot è stata trattenuta (regolamento 1.4.1) — null se la punta è vuota. turnNumber incrementa una volta per turno di QUALSIASI giocatore, quindi i propri turni successivi sono sempre 2 numeri di distanza: se a fine turno questo valore non coincide più con GameState.turnNumber, la carta ha già passato un confine di turno e si consuma (vedi endTurn in turn-engine.ts). */
  tipCardPlacedTurn: number | null;
  /** true se all'inizio di QUESTO turno (fase Preparazione, vedi resolvePreparation) la punta era già occupata da una carta trattenuta in un turno precedente. Blocca holdAtTip anche se quella carta viene spesa più avanti in questa stessa fase Azione — altrimenti si potrebbe usare la carta trattenuta e trattenerne subito un'altra, vanificando il limite "a turni alterni" del potere (1.4.1). */
  tipHeldAtPreparation: boolean;

  // Effetti attivi
  handRevealed: boolean; // Occhio del Sole
  immuneToElement: BaseElement | null; // Abbraccio Radiante
}

/** Mana prismatico (3.2.1): +1 mana permanente sul proprio valore, sempre — indipendente da qualsiasi altro modificatore attivo sulla carta (es. manaBonus del bonus manico). */
const PRISMATIC_MANA_BONUS = 1;

/** Il mana non è un pool salvato: è la somma del valore delle carte in mano in quel momento (regolamento v2, 3.1). */
export function computePlayerMana(hand: readonly Card[]): number {
  return hand.reduce((sum, card) => {
    if (card.tier === 'freeze') return sum; // non-carta (2.3.1): nessun valore di mana
    if (card.tier === 'spell') return sum; // un incantesimo non è un elemento (3.1): il suo `element` serve solo per l'arte
    const prismaticBonus = card.specialMana === 'prismatic' ? PRISMATIC_MANA_BONUS : 0;
    return sum + ELEMENT_MANA[card.element] + (card.manaBonus ?? 0) + prismaticBonus;
  }, 0);
}

/** Solo il primo nome (split sul primo spazio) — usato ovunque un nome visualizzato debba restare compatto (HUD, tracker di fase). */
export function firstNameOf(fullName: string): string {
  const idx = fullName.indexOf(' ');
  return idx > 0 ? fullName.slice(0, idx) : fullName;
}
