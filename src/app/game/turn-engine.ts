import type { Card } from '../models/card.model';
import type { BaseElement } from '../models/element.model';
import { SUPERIOR_FORMULA } from '../models/element.model';
import type { GameState } from '../models/game.model';
import type { PlayerId, PlayerState } from '../models/player.model';
import { TURN_PHASES } from '../models/turn-phase.model';
import { drawUpTo, HAND_SIZE } from './deck-builder';

function updatePlayer(state: GameState, role: PlayerId, patch: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [role]: { ...state.players[role], ...patch },
    },
  };
}

function removeOneByElement(cards: readonly Card[], element: BaseElement): { removed: Card | null; rest: Card[] } {
  const rest = [...cards];
  const index = rest.findIndex(c => c.element === element);
  if (index === -1) return { removed: null, rest };
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

/**
 * Bonus manico (regolamento 1.4.3): 10% di possibilità di +1 mana permanente su un elemento base
 * appena pescato dal mazzo comune; se il manico ha un elemento incastonato, la possibilità sale al
 * 20% ma vale solo per quell'elemento (nessun bonus generico al 10% per gli altri, in quel caso).
 */
function rollHandleBonus(card: Card, handleSocket: BaseElement | null): Card {
  const chance = handleSocket === null ? 0.1 : handleSocket === card.element ? 0.2 : 0;
  if (chance === 0 || Math.random() >= chance) return card;
  return { ...card, manaBonus: (card.manaBonus ?? 0) + 1 };
}

/**
 * Fase Raccolta (4.3), primo passo: pesca 2 carte dal mazzo comune (rimescolando i suoi scarti se
 * esaurito, regolamento 1.7) e le tiene in sospeso in attesa della scelta del giocatore — persistito,
 * non locale, così il mazzo non si disallinea tra il "peek" e la scelta effettiva. No-op se non sei
 * di turno, se hai già raccolto questo turno, o se non ci sono abbastanza carte nemmeno dopo il
 * rimescolamento (caso limite).
 */
export function startCollect(state: GameState, role: PlayerId): GameState {
  if (role !== state.currentTurn) return state;
  const player = state.players[role];
  if (player.hasCollectedThisTurn || player.pendingCollect) return state;

  const { drawn, deck, discards } = drawUpTo(state.commonDeck, state.commonDiscards, 2);
  if (drawn.length < 2) return state;

  const handleSocket = player.wand.handleSocket;
  const pending: [Card, Card] = [
    rollHandleBonus(drawn[0], handleSocket),
    rollHandleBonus(drawn[1], handleSocket),
  ];

  const withDeck: GameState = { ...state, commonDeck: deck, commonDiscards: discards };
  return updatePlayer(withDeck, role, { pendingCollect: pending });
}

/**
 * Fase Raccolta (4.3), secondo passo: tieni una delle 2 carte in sospeso, l'altra torna negli scarti
 * comuni. La carta tenuta va negli scarti del proprio mazzo — non in mano. No-op se non sei di turno
 * o se non c'è una raccolta in sospeso.
 */
export function keepCard(state: GameState, role: PlayerId, keptId: string): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const pending = player.pendingCollect;
  if (!pending) return state;

  const [first, second] = pending;
  const kept = first.id === keptId ? first : second.id === keptId ? second : null;
  if (!kept) return state;
  const rejected = kept === first ? second : first;

  const withDiscards: GameState = { ...state, commonDiscards: [...state.commonDiscards, rejected] };
  return updatePlayer(withDiscards, role, {
    discards: [...player.discards, kept],
    pendingCollect: null,
    hasCollectedThisTurn: true,
  });
}

/**
 * Prende la carta rivelata nello slot indicato della Fonte Arcana e rimpiazza subito lo slot dal
 * mazzo avanzato (rimescolando i suoi scarti se esaurito, caso limite: se anche quelli sono
 * esauriti lo slot preso non si rimpiazza — la Fonte Arcana mostra una carta in meno finché
 * qualcosa non torna negli scarti). Condivisa da combineElements e combineSuperior, che differiscono
 * solo su quali/quante basi consumano dalla mano.
 */
function takeFromFonte(state: GameState, fonteSlotIndex: number): { state: GameState; obtained: Card } | null {
  const obtained = state.fonteElementale[fonteSlotIndex];
  if (!obtained) return null;

  const { drawn, deck: advancedDeck, discards: advancedDiscards } = drawUpTo(state.advancedDeck, state.advancedDiscards, 1);
  const replacement = drawn[0] ?? null;

  const fonteElementale = [...state.fonteElementale];
  if (replacement) {
    fonteElementale[fonteSlotIndex] = replacement;
  } else {
    fonteElementale.splice(fonteSlotIndex, 1);
  }

  return { state: { ...state, fonteElementale, advancedDeck, advancedDiscards }, obtained };
}

/**
 * Fase Azione (2.3/2.6): combina 2 elementi base dalla mano per ottenere la carta rivelata nello
 * slot indicato della Fonte Arcana. Le 2 basi vengono consumate negli scarti del mazzo comune, la
 * carta ottenuta va negli scarti del giocatore. No-op se non sei di turno o se la mano non contiene
 * gli elementi richiesti.
 */
export function combineElements(
  state: GameState,
  role: PlayerId,
  fonteSlotIndex: number,
  a: BaseElement,
  b: BaseElement,
): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const { removed: cardA, rest: handAfterA } = removeOneByElement(player.hand, a);
  if (!cardA) return state;
  const { removed: cardB, rest: handAfterB } = removeOneByElement(handAfterA, b);
  if (!cardB) return state;

  const taken = takeFromFonte(state, fonteSlotIndex);
  if (!taken) return state;

  const withTable: GameState = { ...taken.state, commonDiscards: [...taken.state.commonDiscards, cardA, cardB] };
  return updatePlayer(withTable, role, { hand: handAfterB, discards: [...player.discards, taken.obtained] });
}

/**
 * Fase Azione (2.4/2.6): combina i 4 elementi base della formula fissa (Fuoco+Acqua+Aria+Terra)
 * dalla mano per ottenere l'elemento potente rivelato nello slot indicato della Fonte Arcana —
 * stessa meccanica di combineElements, solo con 4 basi invece di 2. No-op se non sei di turno o se
 * la mano non contiene tutti e 4 gli elementi richiesti.
 */
export function combineSuperior(state: GameState, role: PlayerId, fonteSlotIndex: number): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  let hand = player.hand;
  const consumed: Card[] = [];
  for (const element of SUPERIOR_FORMULA) {
    const { removed, rest } = removeOneByElement(hand, element);
    if (!removed) return state;
    consumed.push(removed);
    hand = rest;
  }

  const taken = takeFromFonte(state, fonteSlotIndex);
  if (!taken) return state;

  const withTable: GameState = { ...taken.state, commonDiscards: [...taken.state.commonDiscards, ...consumed] };
  return updatePlayer(withTable, role, { hand, discards: [...player.discards, taken.obtained] });
}

/**
 * Avanza la fase del giocatore di turno lungo il ciclo delle 6 fasi (sez. 4). 'attesa' non è mai una
 * fase persistita: è solo il valore mostrato all'avversario, calcolato lato UI. Da 'fine' passa
 * davvero il turno: scarta l'intera mano, pesca una mano fresca da 5, resetta i flag di turno.
 * No-op se non sei di turno.
 */
export function advanceTurnPhase(state: GameState, role: PlayerId): GameState {
  if (role !== state.currentTurn) return state;

  const playablePhases = TURN_PHASES.filter(p => p !== 'attesa');
  const currentIndex = playablePhases.indexOf(state.phase);
  const isLastPhase = currentIndex === playablePhases.length - 1;

  if (!isLastPhase) {
    return { ...state, phase: playablePhases[currentIndex + 1] };
  }

  return endTurn(state, role);
}

function endTurn(state: GameState, role: PlayerId): GameState {
  const player = state.players[role];
  const otherRole: PlayerId = role === 'host' ? 'guest' : 'host';

  // Tutte le carte non utilizzate in mano si scartano (vanno negli scarti del proprio mazzo)
  // prima di pescare la mano fresca — se il mazzo si esaurisce, drawUpTo rimescola questi stessi
  // scarti nel mazzo (regolamento 1.7), il che riduce di 1 il livello di avvelenamento (2.3.4/1.7).
  const { drawn, deck, discards, reshuffled } = drawUpTo(player.deck, [...player.discards, ...player.hand], HAND_SIZE);
  const poison = reshuffled ? Math.max(0, player.tokens.poison - 1) : player.tokens.poison;

  const stateAfterEnd = updatePlayer(state, role, {
    hand: drawn,
    deck,
    discards,
    tokens: { ...player.tokens, poison },
    hasCollectedThisTurn: false,
    hasUsedWandAbility: false,
    spellsPlayedThisTurn: 0,
  });

  const stateForNextTurn: GameState = {
    ...stateAfterEnd,
    currentTurn: otherRole,
    phase: 'preparazione',
    turnNumber: state.turnNumber + 1,
  };

  // Fase Preparazione (4.2): risolta subito per chi sta per iniziare il turno, non per chi lo ha
  // appena concluso — non richiede un passo separato, dato che l'unico modo di entrare in
  // 'preparazione' è proprio questo handoff di turno (o l'inizio partita, dove i due contatori sono
  // comunque a zero).
  return resolvePreparation(stateForNextTurn, otherRole);
}

/**
 * Fase Preparazione (4.2): 1 danno per ogni livello di Avvelenamento accumulato, e scioglimento
 * (rimozione dal gioco, non scarto) delle carte Congelamento eventualmente in mano.
 */
function resolvePreparation(state: GameState, target: PlayerId): GameState {
  const player = state.players[target];
  const poisonDamage = player.tokens.poison;
  const hand = player.hand.filter(card => card.tier !== 'freeze');

  return updatePlayer(state, target, { hp: player.hp - poisonDamage, hand });
}

const MAX_POISON = 3;

/**
 * Avvelenamento (2.3.4): incrementa il livello di veleno del bersaglio, cap a 3. Pensata per essere
 * chiamata dagli incantesimi che lo applicano — non ancora implementati, quindi al momento nessun
 * chiamante reale: il decadimento (endTurn) e la risoluzione (resolvePreparation) sopra sono già
 * testabili a prescindere, dato che agiscono sul livello accumulato in `PlayerTokens.poison`.
 */
export function applyPoison(state: GameState, target: PlayerId, amount: number): GameState {
  const player = state.players[target];
  const poison = Math.min(MAX_POISON, player.tokens.poison + amount);
  return updatePlayer(state, target, { tokens: { ...player.tokens, poison } });
}

/**
 * Congelamento (2.3.1): aggiunge `count` carte Congelamento (non-carte, tier 'freeze') agli scarti
 * del bersaglio — finiscono quindi nel suo mazzo alla prossima rimescolata. Pensata per essere
 * chiamata dagli incantesimi che lo applicano — non ancora implementati (vedi nota su applyPoison).
 */
export function applyFreeze(state: GameState, target: PlayerId, count: number): GameState {
  if (count <= 0) return state;
  const player = state.players[target];
  const freezeCards: Card[] = Array.from({ length: count }, () => ({
    id: `freeze-${crypto.randomUUID()}`,
    tier: 'freeze',
    element: 'ice',
  }));
  return updatePlayer(state, target, { discards: [...player.discards, ...freezeCards] });
}
