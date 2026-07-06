import type { Card } from '../models/card.model';
import type { BaseElement } from '../models/element.model';
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

  const withDeck: GameState = { ...state, commonDeck: deck, commonDiscards: discards };
  return updatePlayer(withDeck, role, { pendingCollect: [drawn[0], drawn[1]] });
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
 * Fase Azione (2.3/2.4/2.6): combina 2 elementi base dalla mano per ottenere la carta rivelata nello
 * slot indicato della Fonte Arcana. Le 2 basi vengono consumate negli scarti del mazzo comune, la
 * carta ottenuta va negli scarti del giocatore, lo slot si rimpiazza subito dal mazzo avanzato
 * (rimescolando i suoi scarti se esaurito). No-op se non sei di turno o se la mano non contiene gli
 * elementi richiesti.
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

  const obtained = state.fonteElementale[fonteSlotIndex];
  if (!obtained) return state;

  const { drawn, deck: advancedDeck, discards: advancedDiscards } = drawUpTo(state.advancedDeck, state.advancedDiscards, 1);
  const replacement = drawn[0] ?? null;

  // Caso limite (2.6): se anche gli scarti del mazzo avanzato sono esauriti, lo slot preso non si
  // rimpiazza — la Fonte Arcana mostra semplicemente una carta in meno finché qualcosa non torna negli scarti.
  const fonteElementale = [...state.fonteElementale];
  if (replacement) {
    fonteElementale[fonteSlotIndex] = replacement;
  } else {
    fonteElementale.splice(fonteSlotIndex, 1);
  }

  const withTable: GameState = {
    ...state,
    fonteElementale,
    advancedDeck,
    advancedDiscards,
    commonDiscards: [...state.commonDiscards, cardA, cardB],
  };

  return updatePlayer(withTable, role, {
    hand: handAfterB,
    discards: [...player.discards, obtained],
  });
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
  // scarti nel mazzo (regolamento 1.7), riducendo di 1 il livello di avvelenamento in una milestone futura.
  const { drawn, deck, discards } = drawUpTo(player.deck, [...player.discards, ...player.hand], HAND_SIZE);

  const stateAfterEnd = updatePlayer(state, role, {
    hand: drawn,
    deck,
    discards,
    hasCollectedThisTurn: false,
    hasUsedWandAbility: false,
    spellsPlayedThisTurn: 0,
  });

  return {
    ...stateAfterEnd,
    currentTurn: otherRole,
    phase: 'preparazione',
    turnNumber: state.turnNumber + 1,
  };
}
