import type { Card } from './card.model';
import type { GameLogEntry } from './game-log.model';
import type { PlayerId, PlayerState } from './player.model';
import type { ActiveTurnPhase } from './turn-phase.model';

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
   * Ultimo danno da Avvelenamento risolto (2.3.4, resolvePreparation) — pilota solo l'animazione lato
   * client (icona teschio verde invece del generico lampo rosso): `lastPoisonDamage` viene sostituito
   * non accumulato, `poisonDamageBatchId` incrementa solo quando è avvenuto DAVVERO un danno (livello
   * di veleno > 0 al momento della risoluzione). Serve un segnale esplicito, non un diff sull'HP: la
   * stessa transazione di endTurn potrebbe risolvere anche danno da incantesimo, quindi un'unica
   * perdita di HP osservata dal client potrebbe sommare veleno + incantesimo insieme —
   * derive-events.ts usa questo per scorporare la quota di veleno dal danno generico, non per
   * sostituirlo.
   */
  poisonDamageBatchId: number;
  lastPoisonDamage: { role: PlayerId; amount: number } | null;

  /**
   * Log eventi di gioco (danno/cura/scudo, veleno/congelamento risolti, incantesimi lanciati/creati,
   * combinazioni, bacchetta...) — a differenza di lastPoisonDamage sopra, questo È un log storico
   * vero e proprio (append-only, mai sostituito), condiviso tra i due giocatori: ogni voce nasce già
   * con `role` (chi ha agito/subito), la traduzione in una frase leggibile ("tu"/nome avversario) è
   * responsabilità della UI (GameLogDialogComponent), mai del reducer. Tagliato alle
   * ultime 50 voci (turn-engine.ts, appendLog) per non far crescere il documento Firestore
   * indefinitamente in una partita molto lunga.
   */
  eventLog: readonly GameLogEntry[];

  // Risultato
  winner: PlayerId | null;

  // Meta
  createdAt: number; // timestamp ms di inizio partita (diverso da GameDoc.createdAt, che è la creazione della stanza)
}
