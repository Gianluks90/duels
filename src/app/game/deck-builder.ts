import type {
  AdvancedElement,
  BaseElement,
  Element,
  SuperiorElement,
} from '../models/element.model';
import type { Card, CardTier, SpecialMana } from '../models/card.model';
import type { GameState } from '../models/game.model';
import type { PlayerId, PlayerState } from '../models/player.model';
import type { Wand } from '../models/wand.model';

const BASE_ELEMENTS: readonly BaseElement[] = ['fire', 'water', 'air', 'earth'];
const SUPERIOR_ELEMENTS: readonly SuperiorElement[] = ['light', 'dark'];

/**
 * Le 2 magie seminate nel mazzo iniziale di ogni giocatore (vedi buildPlayerStartingDeck) —
 * un'eccezione dichiarata a "ogni incantesimo si crea" (5.1, non ancora implementato), al posto di
 * Luce/Tenebra rimosse dalle carte iniziali. `element` è solo per l'arte (CardComponent) — usare
 * sempre un elemento base: mai 'light'/'dark' (rientrerebbero nei controlli di resolveElementalExplosions).
 */
const STARTER_SPELLS: ReadonlyArray<{ spellId: string; element: BaseElement }> = [
  { spellId: 'starter_bolt', element: 'fire' },
  { spellId: 'starter_balm', element: 'water' },
];

/**
 * Placeholder — rules.md non specifica la ripartizione per elemento del mazzo comune (60 carte),
 * solo il totale. 15 per elemento è una scelta provvisoria.
 */
const COMMON_DECK_SPLIT: Record<BaseElement, number> = { fire: 15, water: 15, air: 15, earth: 15 };

/** Mana speciale (3.2): 2 copie ciascuno di prismatico/vitale/caotico, assegnate a 6 carte casuali del mazzo comune (60 carte). */
const SPECIAL_MANA_TYPES: readonly SpecialMana[] = ['prismatic', 'vital', 'chaotic'];
const SPECIAL_MANA_COPIES_PER_TYPE = 2;

/** 4 copie per elemento avanzato (regolamento 1.1: mazzo avanzato da 20 carte, 16 avanzati + 4 potenti). */
const ADVANCED_ELEMENT_SPLIT: Record<AdvancedElement, number> = {
  thunder: 4,
  poison: 4,
  ice: 4,
  lava: 4,
};

const SUPERIOR_ELEMENT_COUNT = 2; // per elemento potente, nel mazzo avanzato (regolamento 1.1: 4 potenti totali)
const RESIDIUM_COUNT = 8;
const STARTING_BASE_COUNT = 2; // per elemento base, nelle carte iniziali (regolamento 1.2)
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
  return BASE_ELEMENTS.flatMap((el) => repeat(makeCard, 'base', el, COMMON_DECK_SPLIT[el]));
}

/** Assegna il mana speciale (3.2) a un sottoinsieme casuale del mazzo comune — 2 copie ciascuno di prismatico/vitale/caotico. Puro, non muta l'array in input. */
export function applySpecialMana(commonDeck: readonly Card[]): Card[] {
  const shuffledIndexes = shuffle(commonDeck.map((_, index) => index));
  const typeByIndex = new Map<number, SpecialMana>();
  let cursor = 0;
  for (const type of SPECIAL_MANA_TYPES) {
    for (let i = 0; i < SPECIAL_MANA_COPIES_PER_TYPE; i++) {
      typeByIndex.set(shuffledIndexes[cursor], type);
      cursor++;
    }
  }

  return commonDeck.map((card, index) => {
    const specialMana = typeByIndex.get(index);
    return specialMana ? { ...card, specialMana } : card;
  });
}

/** Mazzo avanzato (22 carte: 18 elementi avanzati + 4 potenti) — vedi ADVANCED_ELEMENT_SPLIT per la nota sul placeholder. */
export function buildAdvancedDeck(makeCard: CardFactory): Card[] {
  const advancedKeys = Object.keys(ADVANCED_ELEMENT_SPLIT) as AdvancedElement[];
  const advanced = advancedKeys.flatMap((el) =>
    repeat(makeCard, 'advanced', el, ADVANCED_ELEMENT_SPLIT[el]),
  );
  const superior = SUPERIOR_ELEMENTS.flatMap((el) =>
    repeat(makeCard, 'superior', el, SUPERIOR_ELEMENT_COUNT),
  );
  return [...advanced, ...superior];
}

/** Residuo Arcano: 8 copie, sempre scoperto (regolamento 2.5) — "il giocatore ha un turno per utilizzarlo, dopodiché si consuma": expiresAt 'fine' vale solo da quando finisce in mano (assegnato qui una volta per tutte, dato che è sempre lo stesso per ogni copia). */
export function buildResiduumDeck(makeCard: CardFactory): Card[] {
  return repeat(makeCard, 'residium', 'residium', RESIDIUM_COUNT).map((card) => ({
    ...card,
    expiresAt: 'fine' as const,
  }));
}

/** Carte iniziali di un giocatore (regolamento 1.2): 2 per elemento base + le 2 magie di STARTER_SPELLS. Luce e Tenebra non ne fanno parte — si ottengono solo combinando nella Fonte Arcana (2.4), come qualunque altro elemento potente. */
export function buildPlayerStartingDeck(makeCard: CardFactory): Card[] {
  const bases = BASE_ELEMENTS.flatMap((el) => repeat(makeCard, 'base', el, STARTING_BASE_COUNT));
  const spells = STARTER_SPELLS.map(({ spellId, element }) => ({
    ...makeCard('spell', element),
    spellId,
  }));
  return [...bases, ...spells];
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
    pendingSpells: [],
    tokens: { shield: 0, poison: 0 },
    cardBack: 'dark',
    hasCollectedThisTurn: false,
    spellsPlayedThisTurn: 0,
    tipCardPlacedTurn: null,
    tipHeldAtPreparation: false,
    handDrawBatchId: 0,
    collectDrawBatchId: 0,
  };
}

/** Costruisce lo stato iniziale completo di una partita (regolamento 1.1, 1.2, 1.5, 1.6). */
export function createInitialGameState(host: PlayerSetup, guest: PlayerSetup): GameState {
  const makeCard = createCardFactory();

  const commonDeck = applySpecialMana(shuffle(buildCommonDeck(makeCard)));

  // 1.1: 1 copia di Luce e 1 di Tenebra (su 2 ciascuna nel mazzo avanzato) partono già negli scarti
  // del mazzo avanzato, non tra le carte da rimescolare — tornano in gioco solo quando il mazzo
  // avanzato si esaurisce una volta e i suoi scarti vengono rimescolati (1.7). Tolte PRIMA di
  // rimescolare, così Fonte Arcana e mazzo avanzato partono con una sola copia "attiva" per tipo.
  const fullAdvancedDeck = buildAdvancedDeck(makeCard);
  const advancedDiscards: Card[] = [];
  const activeAdvancedDeck = [...fullAdvancedDeck];
  for (const el of SUPERIOR_ELEMENTS) {
    const index = activeAdvancedDeck.findIndex((c) => c.element === el);
    if (index !== -1) advancedDiscards.push(...activeAdvancedDeck.splice(index, 1));
  }

  const shuffledAdvancedDeck = shuffle(activeAdvancedDeck);
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
    advancedDiscards,
    residiumDeck,
    explosionBatchId: 0,
    lastExplosions: [],
    poisonDamageBatchId: 0,
    lastPoisonDamage: null,
    eventLog: [],
    winner: null,
    createdAt: Date.now(),
  };
}
