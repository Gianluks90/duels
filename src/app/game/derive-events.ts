import type { GameState } from '../models/game.model';
import type { PlayerId } from '../models/player.model';
import type { GameEvent } from '../models/game-event.model';

const ROLES: readonly PlayerId[] = ['host', 'guest'];

/**
 * Deriva la lista di eventi di gioco discreti avvenuti tra due GameState consecutivi — usata solo
 * per pilotare AnimationQueueService, mai per decidere la logica di gioco (quella legge sempre lo
 * stato grezzo più recente). `prev` null significa "primo stato mai visto": nessun evento, va
 * mostrato direttamente senza animare nulla (vedi AnimationQueueService.sync).
 *
 * Alcuni eventi non sono derivabili da un diff strutturale per costruzione del dominio (Esplosione
 * elementale, ripesca durante Raccolta/Finale: le carte coinvolte si consumano nella stessa
 * transazione atomica in cui entrano in gioco, quindi il client non vede mai lo stato intermedio da
 * cui dedurle) — per quei casi si legge il contatore/payload che il reducer (turn-engine.ts) scrive
 * apposta per il client (explosionBatchId/lastExplosions, handDrawBatchId, collectDrawBatchId), mai
 * un diff. Per tutto il resto (carte scadute sparite dalla mano, bacchetta, HP) un diff per-id o
 * numerico diretto è affidabile.
 */
export function deriveGameEvents(prev: GameState | null, next: GameState): GameEvent[] {
  if (!prev) return [];

  const events: GameEvent[] = [];

  for (const role of ROLES) {
    const prevPlayer = prev.players[role];
    const nextPlayer = next.players[role];

    if (nextPlayer.handDrawBatchId !== prevPlayer.handDrawBatchId) {
      events.push({ type: 'cardsDrawn', role, source: 'hand' });
    }
    if (nextPlayer.collectDrawBatchId !== prevPlayer.collectDrawBatchId) {
      events.push({ type: 'cardsDrawn', role, source: 'collect' });
    }

    const nextHandIds = new Set(nextPlayer.hand.map((c) => c.id));
    const total = prevPlayer.hand.length;
    prevPlayer.hand.forEach((card, index) => {
      if (card.expiresAt && !nextHandIds.has(card.id)) {
        events.push({ type: 'cardVanished', role, card, index, total });
      }
    });

    const prevPair = prevPlayer.pendingCollect;
    const nextPair = nextPlayer.pendingCollect;
    if (
      nextPair &&
      (!prevPair || prevPair[0].id !== nextPair[0].id || prevPair[1].id !== nextPair[1].id)
    ) {
      const boosted = nextPair.filter((c) => (c.manaBonus ?? 0) > 0).map((c) => c.id);
      if (boosted.length > 0) events.push({ type: 'collectBonusRevealed', role, cardIds: boosted });
    }

    // Punta della bacchetta (1.4.1): può solo passare da vuota a occupata o viceversa (holdAtTip
    // rifiuta di sovrascrivere una punta già occupata — non esiste una transizione diretta carta A →
    // carta B).
    const prevTip = prevPlayer.wand.tipSlot;
    const nextTip = nextPlayer.wand.tipSlot;
    if (nextTip && nextTip.id !== prevTip?.id) {
      events.push({ type: 'wandTipFilled', role, card: nextTip });
    } else if (!nextTip && prevTip) {
      events.push({ type: 'wandTipVanished', role, card: prevTip });
    }

    // Asta/manico (1.4.2/1.4.3): un elemento incastonato non lascia mai più il proprio slot
    // (socketElement rifiuta di sovrascriverlo) — sempre e solo null → elemento.
    if (nextPlayer.wand.bodySocket && nextPlayer.wand.bodySocket !== prevPlayer.wand.bodySocket) {
      events.push({
        type: 'wandSocketFilled',
        role,
        slot: 'body',
        element: nextPlayer.wand.bodySocket,
      });
    }
    if (
      nextPlayer.wand.handleSocket &&
      nextPlayer.wand.handleSocket !== prevPlayer.wand.handleSocket
    ) {
      events.push({
        type: 'wandSocketFilled',
        role,
        slot: 'handle',
        element: nextPlayer.wand.handleSocket,
      });
    }

    // Danno/cura: diff numerico diretto sull'HP — copre qualunque causa (Esplosione elementale,
    // incantesimo, veleno in Preparazione), non solo le Esplosioni come faceva il vecchio
    // damageEventFor in board.component.ts.
    if (nextPlayer.hp < prevPlayer.hp) {
      events.push({ type: 'damageDealt', role, amount: prevPlayer.hp - nextPlayer.hp });
    } else if (nextPlayer.hp > prevPlayer.hp) {
      events.push({ type: 'healed', role, amount: nextPlayer.hp - prevPlayer.hp });
    }
  }

  if (next.explosionBatchId !== prev.explosionBatchId) {
    for (const explosion of next.lastExplosions) {
      if (explosion.location === 'hand') {
        events.push({
          type: 'handExploded',
          role: explosion.affectedRoles[0],
          cards: explosion.cards,
        });
      } else {
        events.push({ type: 'fonteExploded' });
      }
    }
  }

  // Fonte Arcana: confronto posizionale (per indice, non per set — qui la posizione è il significato
  // stesso di "rivelata in quello slot").
  const prevFonteIds = prev.fonteElementale.map((c) => c.id);
  const nextFonteIds = next.fonteElementale.map((c) => c.id);
  const fonteChanged =
    nextFonteIds.length !== prevFonteIds.length ||
    nextFonteIds.some((id, i) => id !== prevFonteIds[i]);
  if (fonteChanged) events.push({ type: 'fonteRevealed' });

  return events;
}
