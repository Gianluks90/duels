import type { GameLogEntry } from '../models/game-log.model';
import type { Objective } from '../models/objective.model';
import type { PlayerId } from '../models/player.model';
import { EMPTY_USER_STATS, type UserStats } from '../models/user.model';

/** Delta di UserStats derivabili dall'eventLog di UNA partita (esclude gamesPlayed/wins/losses:
 * quelli dipendono da GameState.winner, non da conteggi sull'eventLog — v. AuthService.applyGameStats). */
type EventLogStatsDelta = Pick<
  UserStats,
  'cardsCollected' | 'combinationsMade' | 'spellsCast' | 'spellCastCounts' | 'damageDealt' | 'healingDone'
>;

/**
 * Calcola quanto un giocatore ha maturato in UNA partita leggendo GameState.eventLog. Non un
 * contatore dedicato per partita (v. "Casi limite" in README): eventLog è tagliato alle ultime 50
 * voci (turn-engine.ts, MAX_LOG_ENTRIES), quindi una partita molto lunga può far sottostimare questi
 * delta — accettato per ora, stesso spirito del resto degli achievements (v. UserStats).
 *
 * `damageDealt` conta solo il danno da INCANTESIMO: esplosione/veleno non hanno un lanciatore
 * attribuibile nel log (v. DamageLogSource) e restano quindi fuori da questa stima.
 */
export function computeStatsDelta(
  eventLog: readonly GameLogEntry[],
  role: PlayerId,
): EventLogStatsDelta {
  const opponentRole: PlayerId = role === 'host' ? 'guest' : 'host';
  const delta: EventLogStatsDelta = {
    cardsCollected: 0,
    combinationsMade: 0,
    spellsCast: 0,
    spellCastCounts: {},
    damageDealt: 0,
    healingDone: 0,
  };

  for (const entry of eventLog) {
    switch (entry.type) {
      case 'cardCollected':
        if (entry.role === role) delta.cardsCollected += 1;
        break;
      case 'combined':
        if (entry.role === role) delta.combinationsMade += 1;
        break;
      case 'spellCast':
        if (entry.role === role) {
          delta.spellsCast += 1;
          delta.spellCastCounts[entry.spellId] = (delta.spellCastCounts[entry.spellId] ?? 0) + 1;
        }
        break;
      case 'healed':
        if (entry.role === role) delta.healingDone += entry.amount;
        break;
      case 'damage':
        // entry.role è chi ha SUBITO il danno (v. logDamage in turn-engine.ts) — "inflitto da me" è
        // solo quando il bersaglio è l'avversario (esclude damage_self, il cui role è casterRole).
        if (entry.role === opponentRole && entry.source.kind === 'spell') {
          delta.damageDealt += entry.amount;
        }
        break;
      default:
        break;
    }
  }

  return delta;
}

function mergeCounts(prior: Record<string, number>, delta: Record<string, number>): Record<string, number> {
  const merged = { ...prior };
  for (const [key, count] of Object.entries(delta)) merged[key] = (merged[key] ?? 0) + count;
  return merged;
}

/** Combina stats precedenti + esito della partita (winner) + delta dall'eventLog in un nuovo
 * UserStats completo — un solo punto che conosce la forma di UserStats, invece di ricostruirla in
 * AuthService a ogni chiamata. */
export function applyGameStatsDelta(
  priorStats: UserStats | undefined,
  role: PlayerId,
  winner: PlayerId | null,
  eventLog: readonly GameLogEntry[],
): UserStats {
  const prior = priorStats ?? EMPTY_USER_STATS;
  const delta = computeStatsDelta(eventLog, role);
  return {
    gamesPlayed: prior.gamesPlayed + 1,
    wins: prior.wins + (winner === role ? 1 : 0),
    losses: prior.losses + (winner !== null && winner !== role ? 1 : 0),
    cardsCollected: prior.cardsCollected + delta.cardsCollected,
    combinationsMade: prior.combinationsMade + delta.combinationsMade,
    spellsCast: prior.spellsCast + delta.spellsCast,
    spellCastCounts: mergeCounts(prior.spellCastCounts, delta.spellCastCounts),
    damageDealt: prior.damageDealt + delta.damageDealt,
    healingDone: prior.healingDone + delta.healingDone,
  };
}

/** Obiettivi il cui progresso ha appena raggiunto la soglia — confronta PRIMA/DOPO l'applicazione
 * del delta, non solo "dopo >= soglia": altrimenti un obiettivo già completato in una partita
 * precedente ricomparirebbe come "appena completato" a ogni partita successiva. */
export function newlyCompletedObjectives(
  catalog: readonly Objective[],
  priorStats: UserStats | undefined,
  nextStats: UserStats,
): string[] {
  const prior = priorStats ?? EMPTY_USER_STATS;
  return catalog
    .filter((objective) => nextStats[objective.metric] >= objective.threshold)
    .filter((objective) => prior[objective.metric] < objective.threshold)
    .map((objective) => objective.id);
}

export interface ObjectiveProgress {
  objective: Objective;
  progress: number;
  claimed: boolean;
}

/** Vista "progresso di ogni obiettivo del catalogo" per l'utente corrente — usata sia dalla colonna
 * a fine partita (result.component.ts) sia dalla pagina Obiettivi, invece di ricalcolarla in due
 * posti. Non filtra i completati: la UI decide cosa mostrare/nascondere (ObjectiveCardComponent). */
export function buildObjectiveProgress(
  catalog: readonly Objective[],
  stats: UserStats | undefined,
  claimedObjectiveIds: readonly string[] | undefined,
): ObjectiveProgress[] {
  const s = stats ?? EMPTY_USER_STATS;
  const claimed = new Set(claimedObjectiveIds ?? []);
  return catalog.map((objective) => ({
    objective,
    progress: s[objective.metric],
    claimed: claimed.has(objective.id),
  }));
}
