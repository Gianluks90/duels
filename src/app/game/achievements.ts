import { COLLECTIBLE_ELEMENT_IDS } from '../data/elements';
import { SPELL_CATALOG } from '../data/spells';
import type { CollectibleElement } from '../models/element.model';
import type { GameLogEntry } from '../models/game-log.model';
import type { Objective, ObjectiveMetric } from '../models/objective.model';
import type { PlayerId } from '../models/player.model';
import { EMPTY_USER_STATS, type UserProfile, type UserStats } from '../models/user.model';

/** Spell.id -> manaCost, costruita una sola volta da SPELL_CATALOG invece di un find() lineare a
 * ogni evento spellCast in computeStatsDelta sotto. */
const SPELL_MANA_COST: Record<string, number> = Object.fromEntries(
  SPELL_CATALOG.map((spell) => [spell.id, spell.manaCost]),
);

/** Delta di UserStats derivabili dall'eventLog di UNA partita (esclude gamesPlayed/wins/losses:
 * quelli dipendono da GameState.winner, non da conteggi sull'eventLog — v. AuthService.applyGameStats). */
type EventLogStatsDelta = Pick<
  UserStats,
  | 'cardsCollected'
  | 'combinationsMade'
  | 'spellsCast'
  | 'spellCastCounts'
  | 'damageDealt'
  | 'healingDone'
  | 'shieldsGained'
  | 'shieldsRemoved'
  | 'elementsObtained'
  | 'manaConsumed'
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
    shieldsGained: 0,
    shieldsRemoved: 0,
    elementsObtained: {},
    manaConsumed: 0,
  };

  for (const entry of eventLog) {
    switch (entry.type) {
      case 'cardCollected':
        // Sempre un base (l'unico tier che passa dalla Fonte comune, v. UserStats.elementsObtained)
        // — ma l'evento porta comunque l'Element esatto, niente da assumere qui.
        if (entry.role === role) {
          delta.cardsCollected += 1;
          delta.elementsObtained[entry.element] = (delta.elementsObtained[entry.element] ?? 0) + 1;
        }
        break;
      case 'combined':
        if (entry.role === role) {
          delta.combinationsMade += 1;
          delta.elementsObtained[entry.element] = (delta.elementsObtained[entry.element] ?? 0) + 1;
        }
        break;
      case 'spellCast':
        if (entry.role === role) {
          delta.spellsCast += 1;
          delta.spellCastCounts[entry.spellId] = (delta.spellCastCounts[entry.spellId] ?? 0) + 1;
          delta.manaConsumed += SPELL_MANA_COST[entry.spellId] ?? 0;
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
      case 'shieldGained':
        // role è chi ha guadagnato lo scudo (shield_add è sempre self-target, v. turn-engine.ts) —
        // "attivato da me" è semplicemente quando quel ruolo sono io.
        if (entry.role === role) delta.shieldsGained += entry.amount;
        break;
      case 'shieldRemoved':
        // role è chi lo ha PERSO (il bersaglio, come damage sopra) — "rimosso da me" è quando il
        // bersaglio è l'avversario.
        if (entry.role === opponentRole) delta.shieldsRemoved += entry.amount;
        break;
      default:
        break;
    }
  }

  return delta;
}

function mergeCounts(
  prior: Record<string, number>,
  delta: Record<string, number>,
): Record<string, number> {
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
  wasFriendDuel: boolean,
): UserStats {
  const prior = priorStats ?? EMPTY_USER_STATS;
  const delta = computeStatsDelta(eventLog, role);
  const won = winner === role;
  const lost = winner !== null && winner !== role;
  return {
    gamesPlayed: prior.gamesPlayed + 1,
    wins: prior.wins + (won ? 1 : 0),
    losses: prior.losses + (lost ? 1 : 0),
    cardsCollected: prior.cardsCollected + delta.cardsCollected,
    combinationsMade: prior.combinationsMade + delta.combinationsMade,
    spellsCast: prior.spellsCast + delta.spellsCast,
    spellCastCounts: mergeCounts(prior.spellCastCounts, delta.spellCastCounts),
    damageDealt: prior.damageDealt + delta.damageDealt,
    healingDone: prior.healingDone + delta.healingDone,
    shieldsGained: prior.shieldsGained + delta.shieldsGained,
    shieldsRemoved: prior.shieldsRemoved + delta.shieldsRemoved,
    elementsObtained: mergeCounts(prior.elementsObtained, delta.elementsObtained),
    manaConsumed: prior.manaConsumed + delta.manaConsumed,
    // "Inarrestabile": +1 su una vittoria, azzerato su una sconfitta, invariato su un pareggio
    // (winner resta null quando entrambi scendono a 0 hp nello stesso reducer, v. resolveVictory in
    // turn-engine.ts) — coerente con winStreakValid() in firestore.rules.
    currentWinStreak: won ? prior.currentWinStreak + 1 : lost ? 0 : prior.currentWinStreak,
    // "Amichevole"/"Rivale": derivati da GameDoc.wasFriendDuel (snapshot al join, v.
    // GameService.joinGame), non dall'eventLog — coerente con friendDuelStatsValid() in
    // firestore.rules.
    friendDuelsPlayed: prior.friendDuelsPlayed + (wasFriendDuel ? 1 : 0),
    friendDuelWins: prior.friendDuelWins + (wasFriendDuel && won ? 1 : 0),
  };
}

/** Un numero per ogni ObjectiveMetric — la maggior parte viene da UserStats (aggiornato a fine
 * partita), `loginStreak`/`rulebookRead`/`friendsCount` sono invece campi indipendenti su
 * UserProfile, aggiornati fuori dal flusso di fine partita (AuthService.ensureUserProfile/
 * markRulebookRead/syncFriendsCount). Qui convergono nello stesso formato così
 * newlyCompletedObjectives/buildObjectiveProgress sotto non devono sapere da dove viene ciascun
 * numero. */
export type ObjectiveProgressSource = Record<ObjectiveMetric, number>;

export function buildProgressSource(
  stats: UserStats | undefined,
  profile: Pick<UserProfile, 'loginStreak' | 'rulebookRead' | 'friendsCount'> | undefined,
): ObjectiveProgressSource {
  const s = stats ?? EMPTY_USER_STATS;
  // Le 11 proiezioni scalari di elementsObtained (v. ObjectiveMetric) — costruite da
  // COLLECTIBLE_ELEMENT_IDS invece di elencarle a mano, restano corrette da sole se il catalogo
  // elementi cambia. Il cast è sicuro: le chiavi generate sono esattamente `element_${CollectibleElement}`.
  const elementProgress = Object.fromEntries(
    COLLECTIBLE_ELEMENT_IDS.map((id) => [`element_${id}`, s.elementsObtained[id] ?? 0]),
  ) as Record<`element_${CollectibleElement}`, number>;

  return {
    gamesPlayed: s.gamesPlayed,
    wins: s.wins,
    losses: s.losses,
    cardsCollected: s.cardsCollected,
    combinationsMade: s.combinationsMade,
    spellsCast: s.spellsCast,
    damageDealt: s.damageDealt,
    healingDone: s.healingDone,
    currentWinStreak: s.currentWinStreak,
    friendDuelsPlayed: s.friendDuelsPlayed,
    friendDuelWins: s.friendDuelWins,
    shieldsGained: s.shieldsGained,
    shieldsRemoved: s.shieldsRemoved,
    manaConsumed: s.manaConsumed,
    // "Arcimago": incantesimi DIVERSI lanciati almeno una volta, non il totale (già `spellsCast`) —
    // proiezione scalare di spellCastCounts, stesso principio di elementProgress sopra ma un solo
    // numero invece di una proiezione per chiave (v. ObjectiveMetric.distinctSpellsCast).
    distinctSpellsCast: Object.values(s.spellCastCounts).filter((count) => count >= 1).length,
    loginStreak: profile?.loginStreak ?? 0,
    rulebookRead: profile?.rulebookRead ? 1 : 0,
    friendsCount: profile?.friendsCount ?? 0,
    ...elementProgress,
  };
}

/** Obiettivi il cui progresso ha appena raggiunto la soglia — confronta PRIMA/DOPO l'aggiornamento
 * (una partita conclusa, ma anche un accesso che allunga lo streak o la lettura del regolamento,
 * v. buildProgressSource sopra), non solo "dopo >= soglia": altrimenti un obiettivo già completato
 * in precedenza ricomparirebbe come "appena completato" ad ogni aggiornamento successivo. */
export function newlyCompletedObjectives(
  catalog: readonly Objective[],
  priorSource: ObjectiveProgressSource,
  nextSource: ObjectiveProgressSource,
): string[] {
  return catalog
    .filter((objective) => nextSource[objective.metric] >= objective.threshold)
    .filter((objective) => priorSource[objective.metric] < objective.threshold)
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
  source: ObjectiveProgressSource,
  claimedObjectiveIds: readonly string[] | undefined,
): ObjectiveProgress[] {
  const claimed = new Set(claimedObjectiveIds ?? []);
  return catalog.map((objective) => ({
    objective,
    progress: source[objective.metric],
    claimed: claimed.has(objective.id),
  }));
}

/** Data odierna in formato 'YYYY-MM-DD', calendario LOCALE del dispositivo (non UTC) — coerente con
 * "hai aperto l'app oggi" per l'utente, non con un fuso orario arbitrario. */
export function todayLocalDate(now: Date = new Date()): string {
  return formatLocalDate(now);
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Prossimo streak di accessi consecutivi (Achievements, "Login 7 giorni consecutivi") dato l'ultimo
 * giorno registrato — null se oggi è già stato registrato (nessuna scrittura necessaria, sicuro da
 * richiamare più volte nella stessa sessione/giornata). +1 se l'ultimo accesso registrato è
 * esattamente ieri, azzerato a 1 altrimenti (streak interrotto, o primo accesso mai registrato).
 * Aritmetica sempre su componenti LOCALI di Date (mai un giro per stringa/UTC), per non introdurre
 * uno sfasamento di un giorno vicino alla mezzanotte in fusi orari diversi da UTC. */
export function nextLoginStreak(
  lastLoginDate: string | undefined,
  priorStreak: number | undefined,
  now: Date = new Date(),
): { date: string; streak: number } | null {
  const today = formatLocalDate(now);
  if (lastLoginDate === today) return null;

  const yesterday = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const streak = lastLoginDate === yesterday ? (priorStreak ?? 0) + 1 : 1;
  return { date: today, streak };
}
