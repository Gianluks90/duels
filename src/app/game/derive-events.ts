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

  // Danno da Avvelenamento (2.3.4): segnale esplicito (poisonDamageBatchId/lastPoisonDamage), non un
  // diff — la stessa transazione di endTurn può risolvere anche un'Esplosione elementale sulla mano
  // appena pescata subito dopo resolvePreparation, quindi un'unica perdita di HP osservata qui
  // potrebbe sommare veleno + esplosione insieme (vedi il commento su quei campi in game.model.ts).
  // Scorporata più sotto dal danno/cura generico per quel ruolo, non aggiunta in più.
  const poisonBatchChanged = next.poisonDamageBatchId !== prev.poisonDamageBatchId;
  const poisonRole = poisonBatchChanged ? next.lastPoisonDamage?.role : undefined;
  const poisonAmount = poisonBatchChanged ? (next.lastPoisonDamage?.amount ?? 0) : 0;

  for (const role of ROLES) {
    const prevPlayer = prev.players[role];
    const nextPlayer = next.players[role];

    // Le carte del batch: diff per-id delle sole AGGIUNTE (id in nextPlayer.hand assenti da
    // prevPlayer.hand) — affidabile qui, a differenza delle rimozioni (vedi il commento in cima al
    // file): una carta con un id nuovo non può che essere appena arrivata, non c'è un caso di
    // rimescolamento che la faccia sembrare "nuova" per errore. Il batch id (non questo diff) resta
    // comunque l'unico segnale che decide SE l'evento è avvenuto.
    if (
      nextPlayer.handDrawBatchId !== prevPlayer.handDrawBatchId ||
      nextPlayer.collectDrawBatchId !== prevPlayer.collectDrawBatchId
    ) {
      const prevHandIds = new Set(prevPlayer.hand.map((c) => c.id));
      const drawnCards = nextPlayer.hand.filter((c) => !prevHandIds.has(c.id));

      if (nextPlayer.handDrawBatchId !== prevPlayer.handDrawBatchId) {
        events.push({ type: 'cardsDrawn', role, source: 'hand', cards: drawnCards });
      }
      if (nextPlayer.collectDrawBatchId !== prevPlayer.collectDrawBatchId) {
        events.push({ type: 'cardsDrawn', role, source: 'collect', cards: drawnCards });
      }
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
    // incantesimo), non solo le Esplosioni come faceva il vecchio damageEventFor in
    // board.component.ts. La quota di veleno (poisonAmount sopra, se questo è il ruolo colpito) viene
    // scorporata prima: quel danno ha già il proprio evento dedicato più sotto.
    const poisonPortion = role === poisonRole ? poisonAmount : 0;
    const hpDrop = prevPlayer.hp - nextPlayer.hp - poisonPortion;
    if (hpDrop > 0) {
      events.push({ type: 'damageDealt', role, amount: hpDrop });
    } else if (hpDrop < 0) {
      events.push({ type: 'healed', role, amount: -hpDrop });
    }
    if (poisonPortion > 0) {
      events.push({ type: 'poisonDamageDealt', role, amount: poisonPortion });
    }

    // Scudo: solo gli AUMENTI (shield_add, 2.3.3) — una diminuzione può venire da un danno appena
    // assorbito (già raccontato dal flash danno sopra) o da uno scudo rimosso da un incantesimo
    // avversario, nessuno dei due merita un proprio "+N".
    if (nextPlayer.tokens.shield > prevPlayer.tokens.shield) {
      events.push({
        type: 'shieldGained',
        role,
        amount: nextPlayer.tokens.shield - prevPlayer.tokens.shield,
      });
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
  // stesso di "rivelata in quello slot"). changedCards porta le carte vere nelle sole posizioni
  // cambiate, per lo stesso ingresso scaglionato di cardsDrawn (AnimationQueueService) — non tutte
  // e 4 se ne cambia solo una (es. una singola combinazione), tutte e 4 se le resetta un incantesimo
  // (fonte_reset in turn-engine.ts).
  const prevFonte = prev.fonteElementale;
  const nextFonte = next.fonteElementale;
  const fonteChangedCards = nextFonte.filter((card, i) => card.id !== prevFonte[i]?.id);
  const fonteChanged = nextFonte.length !== prevFonte.length || fonteChangedCards.length > 0;
  if (fonteChanged) events.push({ type: 'fonteRevealed', cards: fonteChangedCards });

  return events;
}
