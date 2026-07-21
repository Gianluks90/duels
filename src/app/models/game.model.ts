import type { Card } from './card.model';
import type { GameLogEntry } from './game-log.model';
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

  /**
   * Ultimo danno da Avvelenamento risolto (2.3.4, resolvePreparation) — stesso schema di
   * explosionBatchId/lastExplosions sopra: pilota solo l'animazione lato client (icona teschio verde
   * invece del generico lampo rosso), `lastPoisonDamage` viene sostituito non accumulato,
   * `poisonDamageBatchId` incrementa solo quando è avvenuto DAVVERO un danno (livello di veleno > 0
   * al momento della risoluzione). Serve un segnale esplicito, non un diff sull'HP: la stessa
   * transazione di endTurn può anche risolvere un'Esplosione elementale sulla mano appena pescata
   * (resolveElementalExplosions, chiamata subito dopo), quindi un'unica perdita di HP osservata dal
   * client potrebbe sommare veleno + esplosione insieme — derive-events.ts usa questo per scorporare
   * la quota di veleno dal danno generico, non per sostituirlo.
   */
  poisonDamageBatchId: number;
  lastPoisonDamage: { role: PlayerId; amount: number } | null;

  /**
   * Log eventi di gioco (danno/cura/scudo, veleno/congelamento risolti, incantesimi lanciati/creati,
   * combinazioni, bacchetta...) — a differenza di explosionBatchId/lastPoisonDamage sopra, questo È
   * un log storico vero e proprio (append-only, mai sostituito), condiviso tra i due giocatori: ogni
   * voce nasce già con `role` (chi ha agito/subito), la traduzione in una frase leggibile ("tu"/nome
   * avversario) è responsabilità della UI (GameLogDialogComponent), mai del reducer. Tagliato alle
   * ultime 50 voci (turn-engine.ts, appendLog) per non far crescere il documento Firestore
   * indefinitamente in una partita molto lunga.
   */
  eventLog: readonly GameLogEntry[];

  // Risultato
  winner: PlayerId | null;

  // Meta
  createdAt: number; // timestamp ms di inizio partita (diverso da GameDoc.createdAt, che è la creazione della stanza)
}
