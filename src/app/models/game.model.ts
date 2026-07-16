import type { Card } from './card.model';
import type { PlayerId, PlayerState } from './player.model';
import type { ActiveTurnPhase } from './turn-phase.model';

/** Dove è avvenuta un'Esplosione elementale (2.4) — determina chi viene danneggiato: solo il proprietario se in mano, entrambi i giocatori se in Fonte Arcana. */
export type ExplosionLocation = 'hand' | 'fonte';

export interface ExplosionEvent {
  location: ExplosionLocation;
  affectedRoles: readonly PlayerId[];
  /** Le carte esattamente consumate (1 Luce + 1 Tenebra) — permette al client di mostrarne il vero volto invece di dedurre cos'è esploso confrontando la mano prima/dopo. */
  cards: readonly Card[];
}

export interface GameState {
  currentTurn: PlayerId;
  phase: ActiveTurnPhase; // 'attesa' è un valore solo di visualizzazione, mai persistito (vedi ActiveTurnPhase)
  turnNumber: number;
  players: Record<PlayerId, PlayerState>;

  // Stato condiviso del tavolo
  commonDeck: Card[]; // mazzo comune (60), pescato in fase di Raccolta
  commonDiscards: Card[];
  fonteElementale: Card[]; // sempre 4 carte visibili
  advancedDeck: Card[];
  advancedDiscards: Card[];
  residiumDeck: Card[];

  /**
   * Ultima Esplosione elementale risolta (2.4) — pilota solo l'animazione lato client, non un log
   * storico: `lastExplosions` viene sostituita (non accumulata) e `explosionBatchId` incrementa solo
   * quando ne succede davvero una, così il client distingue "niente di nuovo" da "nuova esplosione
   * da animare" anche quando il resto dello stato cambia per altri motivi.
   */
  explosionBatchId: number;
  lastExplosions: readonly ExplosionEvent[];

  // Risultato
  winner: PlayerId | null;

  // Meta
  createdAt: number; // timestamp ms di inizio partita (diverso da GameDoc.createdAt, che è la creazione della stanza)
}
