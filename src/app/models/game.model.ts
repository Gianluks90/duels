import type { Card } from './card.model';
import type { PlayerId, PlayerState } from './player.model';
import type { ActiveTurnPhase } from './turn-phase.model';

export interface GameState {
  currentTurn: PlayerId;
  phase: ActiveTurnPhase;                  // 'attesa' è un valore solo di visualizzazione, mai persistito (vedi ActiveTurnPhase)
  turnNumber: number;
  players: Record<PlayerId, PlayerState>;

  // Stato condiviso del tavolo
  commonDeck: Card[];                      // mazzo comune (60), pescato in fase di Raccolta
  commonDiscards: Card[];
  fonteElementale: Card[];                 // sempre 4 carte visibili
  advancedDeck: Card[];
  advancedDiscards: Card[];
  residiumDeck: Card[];

  // Risultato
  winner: PlayerId | null;

  // Meta
  createdAt: number;                       // timestamp ms di inizio partita (diverso da GameDoc.createdAt, che è la creazione della stanza)
}
