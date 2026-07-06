import type { AdvancedElement, BaseElement, Element, SuperiorElement } from '../models/element.model';
import type { Card, CardTier } from '../models/card.model';
import type { GameState } from '../models/game.model';
import type { PlayerId, PlayerState } from '../models/player.model';
import type { Wand } from '../models/wand.model';

const BASE_ELEMENTS: readonly BaseElement[] = ['fire', 'water', 'air', 'earth'];
const SUPERIOR_ELEMENTS: readonly SuperiorElement[] = ['light', 'dark'];

/**
 * Placeholder — rules.md non specifica la ripartizione per elemento del mazzo comune (60 carte),
 * solo il totale. 15 per elemento è una scelta provvisoria (nessuna carta mana speciale inclusa,
 * dato che quell'effetto è fuori scope in questa milestone). Da rivedere insieme al mana speciale.
 */
const COMMON_DECK_SPLIT: Record<BaseElement, number> = { fire: 15, water: 15, air: 15, earth: 15 };

/**
 * Placeholder — rules.md dà solo il totale (18 avanzati su 4 tipi, che non si divide equamente).
 * Ripartizione arbitraria, da rivedere quando si definisce il contenuto reale delle carte.
 */
const ADVANCED_ELEMENT_SPLIT: Record<AdvancedElement, number> = { thunder: 4, poison: 5, ice: 4, lava: 5 };

const SUPERIOR_ELEMENT_COUNT = 2;    // per elemento potente, nel mazzo avanzato (regolamento 1.1: 4 potenti totali)
const RESIDIUM_COUNT = 8;
const STARTING_BASE_COUNT = 2;       // per elemento base, nelle carte iniziali (regolamento 1.2)
/** Dimensione della mano: sia quella iniziale sia quella pescata in fase Finale (regolamento 1.6, 4.6). */
export const HAND_SIZE = 5;
const FONTE_VISIBLE_COUNT = 4;

export type CardFactory = (tier: CardTier, element: Element) => Card;

/** Un contatore condiviso per tutta la generazione di una partita — id leggibili tipo "base-fire-14", utili in debug su Firestore/devtools. */
export function createCardFactory(): CardFactory {
  let n = 0;
  return (tier, element) => ({ id: `${tier}-${element}-${n++}`, tier, element });
}

/** Fisher-Yates, puro — non muta l'array in input. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function repeat(makeCard: CardFactory, tier: CardTier, element: Element, count: number): Card[] {
  return Array.from({ length: count }, () => makeCard(tier, element));
}

/** Mazzo comune (60 carte base) — vedi COMMON_DECK_SPLIT per la nota sul placeholder. */
export function buildCommonDeck(makeCard: CardFactory): Card[] {
  return BASE_ELEMENTS.flatMap(el => repeat(makeCard, 'base', el, COMMON_DECK_SPLIT[el]));
}

/** Mazzo avanzato (22 carte: 18 elementi avanzati + 4 potenti) — vedi ADVANCED_ELEMENT_SPLIT per la nota sul placeholder. */
export function buildAdvancedDeck(makeCard: CardFactory): Card[] {
  const advancedKeys = Object.keys(ADVANCED_ELEMENT_SPLIT) as AdvancedElement[];
  const advanced = advancedKeys.flatMap(el => repeat(makeCard, 'advanced', el, ADVANCED_ELEMENT_SPLIT[el]));
  const superior = SUPERIOR_ELEMENTS.flatMap(el => repeat(makeCard, 'superior', el, SUPERIOR_ELEMENT_COUNT));
  return [...advanced, ...superior];
}

/** Residuo Arcano: 8 copie, sempre scoperto (regolamento 2.5). */
export function buildResiduumDeck(makeCard: CardFactory): Card[] {
  return repeat(makeCard, 'residium', 'residium', RESIDIUM_COUNT);
}

/** Carte iniziali di un giocatore (regolamento 1.2): 2 per elemento base + 1 Luce + 1 Tenebra. */
export function buildPlayerStartingDeck(makeCard: CardFactory): Card[] {
  const base = BASE_ELEMENTS.flatMap(el => repeat(makeCard, 'base', el, STARTING_BASE_COUNT));
  const superior = SUPERIOR_ELEMENTS.flatMap(el => repeat(makeCard, 'superior', el, 1));
  return [...base, ...superior];
}

export interface DrawResult {
  drawn: Card[];
  deck: Card[];
  discards: Card[];
  /** true se è stato necessario rimescolare gli scarti nel mazzo per completare la pesca (regolamento 1.7). */
  reshuffled: boolean;
}

/** Pesca fino a n carte dalla cima del mazzo, rimescolando gli scarti nel mazzo se si esaurisce (regolamento 1.7, vale per qualsiasi mazzo). */
export function drawUpTo(deck: readonly Card[], discards: readonly Card[], n: number): DrawResult {
  let workingDeck = [...deck];
  let workingDiscards = [...discards];
  let reshuffled = false;

  if (workingDeck.length < n && workingDiscards.length > 0) {
    workingDeck = [...workingDeck, ...shuffle(workingDiscards)];
    workingDiscards = [];
    reshuffled = true;
  }

  const drawn = workingDeck.slice(0, n);
  const deckAfter = workingDeck.slice(n);
  return { drawn, deck: deckAfter, discards: workingDiscards, reshuffled };
}

export interface PlayerSetup {
  name: string;
  wand: Wand;
}

function buildPlayerState(id: PlayerId, setup: PlayerSetup, makeCard: CardFactory): PlayerState {
  const shuffledDeck = shuffle(buildPlayerStartingDeck(makeCard));
  const { drawn, deck } = drawUpTo(shuffledDeck, [], HAND_SIZE);

  return {
    id,
    name: setup.name,
    wand: setup.wand,
    hp: 20,
    hand: drawn,
    deck,
    discards: [],
    pendingCollect: null,
    tokens: { shield: 0, poison: 0, ice: 0 },
    cardBack: 'dark',
    hasCollectedThisTurn: false,
    hasUsedWandAbility: false,
    spellsPlayedThisTurn: 0,
    puntaSpellUsed: false,
    handRevealed: false,
    immuneToElement: null,
  };
}

/** Costruisce lo stato iniziale completo di una partita (regolamento 1.1, 1.2, 1.5, 1.6). */
export function createInitialGameState(host: PlayerSetup, guest: PlayerSetup): GameState {
  const makeCard = createCardFactory();

  const commonDeck = shuffle(buildCommonDeck(makeCard));
  const shuffledAdvancedDeck = shuffle(buildAdvancedDeck(makeCard));
  const fonteElementale = shuffledAdvancedDeck.slice(0, FONTE_VISIBLE_COUNT);
  const advancedDeck = shuffledAdvancedDeck.slice(FONTE_VISIBLE_COUNT);
  const residiumDeck = buildResiduumDeck(makeCard);

  const currentTurn: PlayerId = Math.random() < 0.5 ? 'host' : 'guest';

  return {
    currentTurn,
    phase: 'preparazione',
    turnNumber: 1,
    players: {
      host: buildPlayerState('host', host, makeCard),
      guest: buildPlayerState('guest', guest, makeCard),
    },
    commonDeck,
    commonDiscards: [],
    fonteElementale,
    advancedDeck,
    advancedDiscards: [],
    residiumDeck,
    winner: null,
    createdAt: Date.now(),
  };
}
