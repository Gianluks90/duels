import type { Card } from './card.model';
import type { PlayerId, PlayerState } from './player.model';

export type GameStatus = 'waiting' | 'setup' | 'playing' | 'finished';
export type TurnPhase = 'collect' | 'play' | 'wand' | 'end';

export interface GameState {
  id: string;                              // codice stanza = Firestore doc ID
  status: GameStatus;
  currentTurn: PlayerId;
  phase: TurnPhase;
  turnNumber: number;
  players: Record<PlayerId, PlayerState>;

  // Stato condiviso del tavolo
  fonteElementale: Card[];                 // sempre 4 carte visibili
  advancedDeck: Card[];
  advancedDiscards: Card[];
  residiumDeck: Card[];

  // Risultato
  winner: PlayerId | null;

  // Meta
  createdAt: number;                       // timestamp ms
}
