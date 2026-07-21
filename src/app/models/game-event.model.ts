import type { BaseElement } from './element.model';
import type { Card } from './card.model';
import type { PlayerId } from './player.model';

/**
 * Evento di gioco discreto derivato confrontando due GameState consecutivi (vedi
 * src/app/game/derive-events.ts) — pilota AnimationQueueService, mai la logica di gioco (quella
 * legge sempre lo stato grezzo più recente, mai questi eventi).
 */
export type GameEvent =
  /** Carte nuove entrate in mano (Fine turno/endTurn = 'hand', keepCard/keepMana in Raccolta =
   * 'collect') — `cards` derivate da un diff per-id (sicuro solo per le AGGIUNTE, mai per le
   * rimozioni: vedi il commento in derive-events.ts), usate per lo scaglionamento visivo/sonoro
   * carta-per-carta in AnimationQueueService, non per decidere SE l'evento è avvenuto (quello lo
   * fa il batch id, handDrawBatchId/collectDrawBatchId). */
  | { type: 'cardsDrawn'; role: PlayerId; source: 'hand' | 'collect'; cards: readonly Card[] }
  /** Carta "temporanea" (Congelamento/Residuo, Card.expiresAt) sparita dalla mano. */
  | { type: 'cardVanished'; role: PlayerId; card: Card; index: number; total: number }
  | { type: 'handExploded'; role: PlayerId; cards: readonly Card[] }
  | { type: 'fonteExploded' }
  /** Slot della Fonte Arcana cambiati nell'ultimo batch — `cards` sono le carte nuove nelle
   * posizioni cambiate (confronto posizionale, non per-id: qui la posizione È il significato di
   * "rivelata in quello slot"), usate per lo stesso ingresso scaglionato di cardsDrawn. */
  | { type: 'fonteRevealed'; cards: readonly Card[] }
  | { type: 'wandTipFilled'; role: PlayerId; card: Card }
  | { type: 'wandTipVanished'; role: PlayerId; card: Card }
  | { type: 'wandSocketFilled'; role: PlayerId; slot: 'body' | 'handle'; element: BaseElement }
  /** Bonus manico (1.4.3) rivelato su una o entrambe le carte appena pescate in Raccolta. */
  | { type: 'collectBonusRevealed'; role: PlayerId; cardIds: readonly string[] }
  /** Danno generico (esplosione, incantesimo...) — la quota di danno da Avvelenamento nella stessa
   * transazione (se presente) è già stata scorporata, vedi poisonDamageDealt sotto. */
  | { type: 'damageDealt'; role: PlayerId; amount: number }
  | { type: 'healed'; role: PlayerId; amount: number }
  /** Scudo aumentato (shield_add, 2.3.3) — solo gli aumenti, mai le diminuzioni (assorbimento di un
   * danno o rimozione da un incantesimo avversario), vedi derive-events.ts. */
  | { type: 'shieldGained'; role: PlayerId; amount: number }
  /** Danno da Avvelenamento (2.3.4, resolvePreparation) — derivato da GameState.poisonDamageBatchId/
   * lastPoisonDamage, mai da un diff sull'HP (vedi il commento su quei campi in game.model.ts). */
  | { type: 'poisonDamageDealt'; role: PlayerId; amount: number };
