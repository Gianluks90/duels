import { CARD_PATTERN_CATALOG } from '../data/card-patterns';
import { COLLECTIBLE_ELEMENT_IDS } from '../data/elements';
import { SPELL_CATALOG } from '../data/spells';
import type { Card } from '../models/card.model';
import type { CardPattern } from '../models/card-pattern.model';
import type { CollectibleElement } from '../models/element.model';
import type { GameLogEntry } from '../models/game-log.model';
import type { Objective, ObjectiveMetric } from '../models/objective.model';
import type { PlayerId, PlayerState } from '../models/player.model';
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
  | 'freezeApplied'
  | 'poisonApplied'
  | 'elementsObtained'
  | 'manaConsumed'
  | 'tipHeld'
  | 'bodySocketed'
  | 'handleSocketed'
  | 'wandDamageResisted'
  | 'selfDamageResisted'
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
    freezeApplied: 0,
    poisonApplied: 0,
    elementsObtained: {},
    manaConsumed: 0,
    tipHeld: 0,
    bodySocketed: 0,
    handleSocketed: 0,
    wandDamageResisted: 0,
    selfDamageResisted: 0,
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
      case 'freezeApplied':
        // role è chi lo ha RICEVUTO (il bersaglio) — "applicato da me" è quando il bersaglio è
        // l'avversario, stesso principio di shieldRemoved sopra.
        if (entry.role === opponentRole) delta.freezeApplied += entry.amount;
        break;
      case 'poisonApplied':
        if (entry.role === opponentRole) delta.poisonApplied += entry.amount;
        break;
      case 'wandTipHeld':
        if (entry.role === role) delta.tipHeld += 1;
        break;
      case 'wandSocketed':
        if (entry.role === role) {
          if (entry.slot === 'body') delta.bodySocketed += 1;
          else delta.handleSocketed += 1;
        }
        break;
      // 'vulnerable' non alimenta ancora nessun contatore — nessun achievement lo legge oggi (v.
      // "Temerario"/"Non temo nulla" in documentation/achievement-titles.md, non ancora implementato).
      case 'wandResistanceTriggered':
        if (entry.role === role && entry.outcome === 'resisted') {
          delta.wandDamageResisted += 1;
          if (entry.selfInflicted) delta.selfDamageResisted += 1;
        }
        break;
      default:
        break;
    }
  }

  return delta;
}

/** "Vipera": hai vinto E l'ultima voce `damage` sul PERDENTE nell'eventLog ha `source.kind ===
 * 'poison'` — non serve altro contesto. La vittoria si decide subito dopo ogni reducer (v.
 * `resolveVictory`/`isGameOver` in `turn-engine.ts`, applicate da `GameEngineService.mutate()`),
 * quindi l'ULTIMA voce `damage` che colpisce chi ha perso è per forza il colpo letale, non una tra
 * tante — a differenza di altri delta qui sopra, non serve sommare né filtrare per `role`, basta
 * l'ultima corrispondenza scandendo il log a ritroso. */
function wonWithPoisonFinish(
  eventLog: readonly GameLogEntry[],
  winner: PlayerId | null,
  role: PlayerId,
): boolean {
  if (winner !== role) return false;
  const opponentRole: PlayerId = role === 'host' ? 'guest' : 'host';
  for (let i = eventLog.length - 1; i >= 0; i--) {
    const entry = eventLog[i];
    if (entry.type === 'damage' && entry.role === opponentRole) {
      return entry.source.kind === 'poison';
    }
  }
  return false;
}

/** "Temerario"/"Temeraria"/"Non temo nulla": hai vinto E, in QUALUNQUE momento della partita, la tua
 * Vulnerabilità ha aumentato un danno AUTO-inflitto (`wandResistanceTriggered`, `outcome ===
 * 'vulnerable' && selfInflicted` — oggi possibile solo con Fiamma Nera, l'unico incantesimo con
 * `damage_self`, lanciata con l'elemento opposto al Fuoco incastonato nell'asta). A differenza di
 * `wonWithPoisonFinish` sopra non serve l'ULTIMA occorrenza (l'azzardo può essere stato preso in un
 * turno qualunque, non necessariamente quello decisivo) — basta che sia successo almeno una volta in
 * una partita poi vinta. */
function wonWithSelfVulnerable(
  eventLog: readonly GameLogEntry[],
  winner: PlayerId | null,
  role: PlayerId,
): boolean {
  if (winner !== role) return false;
  return eventLog.some(
    (entry) =>
      entry.type === 'wandResistanceTriggered' &&
      entry.role === role &&
      entry.outcome === 'vulnerable' &&
      entry.selfInflicted,
  );
}

/** L'identificativo di una carta ai fini di CARD_PATTERN_CATALOG: lo SpellId se è un incantesimo
 * (tier 'spell'), altrimenti il suo Element — v. CardPattern.cardKind in card-pattern.model.ts. */
function cardIdentifier(card: Card): string {
  return card.spellId ?? card.element;
}

/** Tutte le carte "vere" (esclude 'freeze'/'mana', non-carte runtime — v. card.model.ts) che un
 * giocatore ha accumulato durante la partita, ovunque si trovino al momento in cui questa finisce:
 * mazzo residuo + mano + scarti, più le carte "in transito" (pendingCollect non ancora deciso,
 * pendingSpells non ancora risolti in fase Incantesimo) — lo stesso "mazzo" nel senso ampio di un
 * gioco di carte fisico (tutto quello che era mano/scarti/mazzo/pending fino a un istante prima),
 * non il solo PlayerState.deck. */
function finalPlayerCards(player: PlayerState): Card[] {
  return [
    ...player.deck,
    ...player.hand,
    ...player.discards,
    ...(player.pendingCollect ?? []),
    ...player.pendingSpells.map((pending) => pending.card),
  ].filter((card) => card.tier !== 'freeze' && card.tier !== 'mana');
}

/** Un pattern combacia con l'insieme di carte accumulate? `requireWin` (es. "Fortunato") esce
 * subito se il giocatore non ha vinto, prima ancora di guardare le carte. Poi filtra per `cardKind`
 * (le carte dell'altro genere non contano né a favore né dentro le modalità esclusive sotto — es.
 * le magie create non "rompono" un pattern sugli elementi), infine confronta gli identificativi
 * presenti con quelli richiesti secondo la modalità (v. CardPatternMode). */
function matchesPattern(cards: readonly Card[], pattern: CardPattern, won: boolean): boolean {
  if (pattern.requireWin && !won) return false;

  const relevant = cards.filter((card) =>
    pattern.cardKind === 'spell' ? card.tier === 'spell' : card.tier !== 'spell',
  );
  const present = new Set(relevant.map(cardIdentifier));
  switch (pattern.mode) {
    case 'contains':
      return pattern.identifiers.every((id) => present.has(id));
    case 'exclusiveAll': {
      // allowedExtra (es. le magie base tollerate insieme a Reset+Rischio in "Fortunato"): non
      // richieste, ma se presenti non contano come "qualcos'altro" ai fini dell'esclusività.
      const allowed = new Set([...pattern.identifiers, ...(pattern.allowedExtra ?? [])]);
      return (
        pattern.identifiers.every((id) => present.has(id)) &&
        [...present].every((id) => allowed.has(id))
      );
    }
    case 'exclusiveAny':
      return relevant.length > 0 && [...present].every((id) => pattern.identifiers.includes(id));
    case 'excludes':
      return pattern.identifiers.every((id) => !present.has(id));
  }
}

/** Quali pattern di CARD_PATTERN_CATALOG combaciano con le carte accumulate dal giocatore in UNA
 * partita appena conclusa — 1 se combacia, la chiave è del tutto assente altrimenti (mai 0: v.
 * mergeCounts sotto, stesso schema di spellCastCounts/elementsObtained). `won`: se QUESTO giocatore
 * ha vinto la partita — v. CardPattern.requireWin. */
export function computeCardPatternMatches(
  player: PlayerState,
  won: boolean,
): Record<string, number> {
  const cards = finalPlayerCards(player);
  const matches: Record<string, number> = {};
  for (const pattern of CARD_PATTERN_CATALOG) {
    if (matchesPattern(cards, pattern, won)) matches[pattern.id] = 1;
  }
  return matches;
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
  finalPlayer: PlayerState,
): UserStats {
  const prior = priorStats ?? EMPTY_USER_STATS;
  const delta = computeStatsDelta(eventLog, role);
  const won = winner === role;
  const lost = winner !== null && winner !== role;
  const patternMatches = computeCardPatternMatches(finalPlayer, won);
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
    freezeApplied: prior.freezeApplied + delta.freezeApplied,
    poisonApplied: prior.poisonApplied + delta.poisonApplied,
    elementsObtained: mergeCounts(prior.elementsObtained, delta.elementsObtained),
    manaConsumed: prior.manaConsumed + delta.manaConsumed,
    cardPatternMatches: mergeCounts(prior.cardPatternMatches, patternMatches),
    // "Inarrestabile": +1 su una vittoria, azzerato su una sconfitta, invariato su un pareggio
    // (winner resta null quando entrambi scendono a 0 hp nello stesso reducer, v. resolveVictory in
    // turn-engine.ts) — coerente con winStreakValid() in firestore.rules.
    currentWinStreak: won ? prior.currentWinStreak + 1 : lost ? 0 : prior.currentWinStreak,
    // "Amichevole"/"Rivale": derivati da GameDoc.wasFriendDuel (snapshot al join, v.
    // GameService.joinGame), non dall'eventLog — coerente con friendDuelStatsValid() in
    // firestore.rules.
    friendDuelsPlayed: prior.friendDuelsPlayed + (wasFriendDuel ? 1 : 0),
    friendDuelWins: prior.friendDuelWins + (wasFriendDuel && won ? 1 : 0),
    tipHeld: prior.tipHeld + delta.tipHeld,
    bodySocketed: prior.bodySocketed + delta.bodySocketed,
    handleSocketed: prior.handleSocketed + delta.handleSocketed,
    // "Vipera": al massimo 1 per partita, v. wonWithPoisonFinish sopra.
    poisonFinishWins:
      prior.poisonFinishWins + (wonWithPoisonFinish(eventLog, winner, role) ? 1 : 0),
    wandDamageResisted: prior.wandDamageResisted + delta.wandDamageResisted,
    selfDamageResisted: prior.selfDamageResisted + delta.selfDamageResisted,
    // "Temerario"/"Non temo nulla": al massimo 1 per partita, v. wonWithSelfVulnerable sopra.
    selfVulnerableWins:
      prior.selfVulnerableWins + (wonWithSelfVulnerable(eventLog, winner, role) ? 1 : 0),
  };
}

/**
 * Quali ObjectiveMetric si sono mossi in QUESTA partita (colonna Achievements a fine partita,
 * result.component.ts) — a differenza di newlyCompletedObjectives sotto (che confronta due
 * ObjectiveProgressSource per trovare cosa ha appena RAGGIUNTO la soglia), qui basta che il
 * contributo di questa singola partita sul metric sia diverso da zero, soglia raggiunta o no:
 * "influenzato dalla partita", non "completato dalla partita". Ricostruito da zero dall'eventLog/
 * esito invece che confrontando profilo prima/dopo, perché a differenza di applyGameStats() questo
 * deve restare corretto anche riaprendo la pagina risultato in una sessione successiva, quando
 * `AuthService.profile()` riflette già stats cumulativi ben oltre questa sola partita.
 *
 * `loginStreak`/`rulebookRead`/`friendsCount` restano sempre fuori: si aggiornano fuori dal flusso
 * di fine partita (v. buildProgressSource sopra), nessuna partita li tocca mai. `distinctSpellsCast`
 * è un'approssimazione: "influenzato" ogni volta che si è lanciato almeno un incantesimo in questa
 * partita, non solo quando se ne lancia uno MAI lanciato prima (richiederebbe i conteggi prima
 * della partita, che qui non abbiamo) — un incantesimo già noto rilanciato risulta quindi incluso
 * anche se la metrica in sé non si è mossa, l'unico falso positivo accettato in questa funzione.
 */
export function matchAffectedMetrics(
  eventLog: readonly GameLogEntry[],
  role: PlayerId,
  winner: PlayerId | null,
  wasFriendDuel: boolean,
  finalPlayer: PlayerState,
): ReadonlySet<ObjectiveMetric> {
  const delta = computeStatsDelta(eventLog, role);
  const won = winner === role;
  const lost = winner !== null && winner !== role;
  const patternMatches = computeCardPatternMatches(finalPlayer, won);

  const affected = new Set<ObjectiveMetric>(['gamesPlayed']);
  if (won) affected.add('wins');
  if (lost) affected.add('losses');
  // currentWinStreak cambia sempre tranne che su un pareggio (v. applyGameStatsDelta sopra: +1, o
  // azzerato, mai invariato quando `winner` è deciso).
  if (winner !== null) affected.add('currentWinStreak');
  if (wasFriendDuel) {
    affected.add('friendDuelsPlayed');
    if (won) affected.add('friendDuelWins');
  }
  if (delta.cardsCollected > 0) affected.add('cardsCollected');
  if (delta.combinationsMade > 0) affected.add('combinationsMade');
  if (delta.spellsCast > 0) {
    affected.add('spellsCast');
    affected.add('distinctSpellsCast');
  }
  if (delta.damageDealt > 0) affected.add('damageDealt');
  if (delta.healingDone > 0) affected.add('healingDone');
  if (delta.shieldsGained > 0) affected.add('shieldsGained');
  if (delta.shieldsRemoved > 0) affected.add('shieldsRemoved');
  if (delta.freezeApplied > 0) affected.add('freezeApplied');
  if (delta.poisonApplied > 0) affected.add('poisonApplied');
  if (delta.manaConsumed > 0) affected.add('manaConsumed');
  if (delta.tipHeld > 0) affected.add('tipHeld');
  if (delta.bodySocketed > 0) affected.add('bodySocketed');
  if (delta.handleSocketed > 0) affected.add('handleSocketed');
  if (delta.wandDamageResisted > 0) affected.add('wandDamageResisted');
  if (delta.selfDamageResisted > 0) affected.add('selfDamageResisted');
  if (delta.tipHeld > 0 || delta.bodySocketed > 0 || delta.handleSocketed > 0) {
    affected.add('wandActionsTotal');
  }
  if (wonWithPoisonFinish(eventLog, winner, role)) affected.add('poisonFinishWins');
  if (wonWithSelfVulnerable(eventLog, winner, role)) affected.add('selfVulnerableWins');
  for (const element of Object.keys(delta.elementsObtained)) {
    affected.add(`element_${element}` as `element_${CollectibleElement}`);
  }
  for (const patternId of Object.keys(patternMatches)) {
    affected.add(`pattern_${patternId}` as ObjectiveMetric);
  }

  return affected;
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
  // Stessa idea di elementProgress sopra, applicata a UserStats.cardPatternMatches (v.
  // CARD_PATTERN_CATALOG) — una proiezione scalare per pattern di composizione mazzo.
  const patternProgress = Object.fromEntries(
    CARD_PATTERN_CATALOG.map((pattern) => [
      `pattern_${pattern.id}`,
      s.cardPatternMatches[pattern.id] ?? 0,
    ]),
  ) as Record<`pattern_${CardPattern['id']}`, number>;

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
    freezeApplied: s.freezeApplied,
    poisonApplied: s.poisonApplied,
    manaConsumed: s.manaConsumed,
    // "Arcimago": incantesimi DIVERSI lanciati almeno una volta, non il totale (già `spellsCast`) —
    // proiezione scalare di spellCastCounts, stesso principio di elementProgress sopra ma un solo
    // numero invece di una proiezione per chiave (v. ObjectiveMetric.distinctSpellsCast).
    distinctSpellsCast: Object.values(s.spellCastCounts).filter((count) => count >= 1).length,
    loginStreak: profile?.loginStreak ?? 0,
    rulebookRead: profile?.rulebookRead ? 1 : 0,
    friendsCount: profile?.friendsCount ?? 0,
    tipHeld: s.tipHeld,
    bodySocketed: s.bodySocketed,
    handleSocketed: s.handleSocketed,
    poisonFinishWins: s.poisonFinishWins,
    wandDamageResisted: s.wandDamageResisted,
    selfDamageResisted: s.selfDamageResisted,
    selfVulnerableWins: s.selfVulnerableWins,
    // Dorso "wands": impegno complessivo con la bacchetta, non un'azione specifica — v.
    // ObjectiveMetric.wandActionsTotal.
    wandActionsTotal: s.tipHeld + s.bodySocketed + s.handleSocketed,
    ...elementProgress,
    ...patternProgress,
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
