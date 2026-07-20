import type { BaseElement } from './element.model';
import type { Card } from './card.model';
import type { PlayerId } from './player.model';

/**
 * Evento di gioco discreto derivato confrontando due GameState consecutivi (vedi
 * src/app/game/derive-events.ts) — pilota AnimationQueueService, mai la logica di gioco (quella
 * legge sempre lo stato grezzo più recente, mai questi eventi).
 */
export type GameEvent =
  | { type: 'cardsDrawn'; role: PlayerId; source: 'hand' | 'collect' }
  /** Carta "temporanea" (Congelamento/Residuo, Card.expiresAt) sparita dalla mano. */
  | { type: 'cardVanished'; role: PlayerId; card: Card; index: number; total: number }
  | { type: 'handExploded'; role: PlayerId; cards: readonly Card[] }
  | { type: 'fonteExploded' }
  | { type: 'fonteRevealed' }
  | { type: 'wandTipFilled'; role: PlayerId; card: Card }
  | { type: 'wandTipVanished'; role: PlayerId; card: Card }
  | { type: 'wandSocketFilled'; role: PlayerId; slot: 'body' | 'handle'; element: BaseElement }
  /** Bonus manico (1.4.3) rivelato su una o entrambe le carte appena pescate in Raccolta. */
  | { type: 'collectBonusRevealed'; role: PlayerId; cardIds: readonly string[] }
  | { type: 'damageDealt'; role: PlayerId; amount: number }
  | { type: 'healed'; role: PlayerId; amount: number };
