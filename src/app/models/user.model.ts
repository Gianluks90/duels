import type { CardBackSkin } from './player.model';

/** Id di default per UserProfile.background — qui (non in background.service.ts) perché sia
 * AuthService (profilo nuovo) sia BackgroundService (fallback prima che il profilo carichi) ne
 * hanno bisogno senza dipendere l'uno dall'altro. Deve combaciare con un id presente in
 * public/config/backgrounds.json. */
export const DEFAULT_BACKGROUND_ID = 'dark-wood';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  cardBack: CardBackSkin;
  /** Id dello sfondo dell'app (public/config/backgrounds.json), applicato globalmente da
   * BackgroundService. */
  background: string;
  createdAt: number;
  /** Id di Spell.id (SPELL_CATALOG) segnati come preferiti — max 5 (vedi AuthService.toggleFavoriteSpell).
   * Assente sui profili creati prima di questa feature: va letto con `?? []`. */
  favoriteSpellIds?: string[];
  /** Dorsi bonus posseduti (oltre ai gratuiti in public/config/card-backs.json) — sbloccati via
   * "riscatta codice" (AuthService.redeemCode). Assente sui profili senza sblocchi: `?? []`. */
  unlockedCardBacks?: string[];
  /** Codici già riscattati da questo utente — usato sia per il messaggio "già riscattato" in UI sia
   * come sorgente di verità per AuthService.redeemCode(); v. anche redeemValid() in firestore.rules. */
  redeemedCodeIds?: string[];
  /** Ultimo codice riscattato — persistito per un solo motivo: dare alla regola Firestore su
   * users/{userId} un riferimento diretto a QUALE codes/{CODICE} verificare quando cardBack/
   * unlockedCardBacks cambiano insieme a redeemedCodeIds (le regole non possono altrimenti risalire
   * a quale codice ha generato lo sblocco). Nessun altro scopo applicativo. */
  lastRedeemedCode?: string;
  /** Statistiche cumulative lifetime (Achievements) — assenti sui profili creati prima di questa
   * feature, va letto con `?? EMPTY_USER_STATS`. Aggiornate una volta per partita conclusa da
   * AuthService.applyGameStats(). */
  stats?: UserStats;
  /** Ultima partita i cui delta sono stati applicati a `stats` — stesso ruolo di lastRedeemedCode:
   * unico riferimento che permette alla regola Firestore su users/{userId} di sapere QUALE
   * games/{gameId} verificare. A differenza del riscatto codice, `stats` è cumulativo (non un
   * semplice on/off), quindi il vero guardiano anti-replay è la sottocollezione
   * users/{userId}/countedGames/{gameId} (marker create-only, v. firestore.rules) — questo campo da
   * solo non impedirebbe di ricontare la stessa partita alternando due gameId diversi. */
  lastStatsGameId?: string;
  /** Sfondi bonus posseduti (oltre ai gratuiti in public/config/backgrounds.json) — sbloccati
   * completando obiettivi (OBJECTIVE_CATALOG). Stesso schema di unlockedCardBacks: assente sui
   * profili senza sblocchi, va letto con `?? []`. */
  unlockedBackgrounds?: string[];
  /** Titolo mostrato sul profilo (Achievements) — a differenza di cardBack/background non esiste un
   * "titolo gratuito" di default: assente finché non se ne sblocca uno, il profilo semplicemente non
   * ne mostra nessuno. Deve comparire in unlockedTitles (v. titleValid() in firestore.rules). */
  title?: string;
  /** Titoli sbloccati completando obiettivi — v. title sopra. Assente sui profili senza sblocchi. */
  unlockedTitles?: string[];
  /** Id di Objective.id (OBJECTIVE_CATALOG) il cui progresso ha raggiunto la soglia — scritto insieme
   * a `stats`/`lastStatsGameId` da AuthService.applyGameStats(). Un obiettivo completato resta tale
   * per sempre (mai rimosso, anche se in teoria un contatore potesse scendere — non succede con le
   * metriche cumulative attuali). Non implica che il reward sia già stato incassato: v.
   * claimedObjectiveIds sotto. */
  completedObjectiveIds?: string[];
  /** Sottoinsieme di completedObjectiveIds i cui reward sono già stati accreditati (v.
   * AuthService.claimObjective) — invariante mantenuto anche lato regole (v. firestore.rules):
   * claimedObjectiveIds ⊆ completedObjectiveIds sempre. Un obiettivo "completato ma non riscattato"
   * è quello che la UI (colonna fine partita, pagina Obiettivi) mostra con il bottone "Riscatta". */
  claimedObjectiveIds?: string[];
  /** Ultimo giorno (calendario LOCALE del dispositivo, 'YYYY-MM-DD') in cui l'accesso è stato
   * registrato — Achievements "Login 7 giorni consecutivi" (v. game/achievements.ts,
   * nextLoginStreak). Aggiornato ad ogni avvio app (AuthService.ensureUserProfile), non ad ogni
   * singolo caricamento di pagina nello stesso giorno. Assente sui profili creati prima di questa
   * feature. */
  lastLoginDate?: string;
  /** Giorni consecutivi di accesso fino a lastLoginDate — si azzera a 1 se un giorno viene saltato
   * (mai a 0: il giorno in cui si azzera è comunque un accesso). Assente sui profili creati prima di
   * questa feature, va letto con `?? 0`. */
  loginStreak?: number;
  /** Achievements "Istruito"/"Istruita" — true una volta che ogni sezione del regolamento
   * (public/config/regolamento.json) è stata aperta almeno una volta in RulebookDialogComponent.
   * Mai true → false. Assente sui profili che non l'hanno ancora letto. */
  rulebookRead?: boolean;
  /** Numero di amicizie accettate — Achievements "Duellante socievole"/"Duellante amichevole".
   * Sincronizzato da AuthService.syncFriendsCount() ogni volta che FriendsComponent carica la
   * lista completa per intero (FriendsService.listFriends), non un contatore incrementato a ogni
   * singola accettazione: più semplice, e quel numero va comunque recuperato per disegnare la lista
   * quindi il costo aggiuntivo è pari a zero. Può scendere (disamicizia) — un obiettivo già
   * completato resta comunque tale per sempre, stesso spirito di currentWinStreak sopra. Assente sui
   * profili mai sincronizzati, va letto con `?? 0`. */
  friendsCount?: number;
  /** Varianti elemento (arte v1) sbloccate — Achievements "Variante 'Elemento X'" (uno per
   * `COLLECTIBLE_ELEMENT_IDS`, v. data/elements.ts). Stesso schema equip-meno di unlockedCardBacks/
   * unlockedBackgrounds (qui non c'è un "equip" — l'arte v1 si vede affiancata alla corrente in
   * Collezione, non si sceglie in game): letta direttamente da CollectionComponent.elementItems.
   * Assente sui profili senza sblocchi, va letto con `?? []`. */
  unlockedElementVariants?: string[];
}

/** Numero massimo di incantesimi che un utente può segnare come preferiti (globale, account-level). */
export const MAX_FAVORITE_SPELLS = 5;

/**
 * Statistiche cumulative lifetime di un utente (Achievements) — alimentano l'`OBJECTIVE_CATALOG`
 * (metric + soglia). `spellCastCounts` è l'unico contatore non scalare (mappa Spell.id -> volte
 * lanciato), serve per obiettivi tipo "lancia 10 volte l'incantesimo X" per ogni incantesimo.
 *
 * Nota sull'integrità: le regole Firestore non supportano filtri/lambda su array, quindi possono
 * validare ESATTAMENTE solo ciò che si riduce a un confronto scalare leggibile da games/{id} (qui
 * wins/losses/gamesPlayed, dal solo `state.winner`) — tutto il resto (derivato contando occorrenze
 * nell'eventLog) è validato solo per PLAUSIBILITÀ (delta non negativo, entro un tetto largo a
 * partita), non per valore esatto. `spellCastCounts` è validato solo nella dimensione (max 100
 * chiavi), mai nei valori.
 *
 * Rischio accettato consapevolmente (audit del 2026-07, stesso spirito di password/visibility della
 * lobby in firestore.rules): il guardiano anti-replay (`users/{uid}/countedGames/{gameId}`, v.
 * firestore.rules) blocca il replay solo attraverso il client reale (AuthService scrive sempre
 * stats+marker insieme) — le regole Firestore valutano ogni documento in modo indipendente, quindi
 * non possono obbligare le due scritture ad avvenire insieme. Un client scritto ad hoc potrebbe
 * quindi gonfiarsi i propri stats senza limite. Confinato al proprio account, ricompense cosmetiche:
 * una vera garanzia richiederebbe una Cloud Function che aggreghi lo stats server-side.
 */
export interface UserStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  cardsCollected: number;
  combinationsMade: number;
  spellsCast: number;
  spellCastCounts: Record<string, number>;
  damageDealt: number;
  healingDone: number;
  /** Vittorie consecutive (Achievements, "Inarrestabile") — a differenza degli altri campi qui NON
   * è monotono: si azzera alla prima sconfitta, resta invariato su un pareggio (GameState.winner
   * null). Derivabile ESATTAMENTE da `winner` come wins/losses sopra (v. winStreakValid() in
   * firestore.rules), non da un conteggio sull'eventLog. */
  currentWinStreak: number;
  /** Partite concluse con un amico come avversario (Achievements, "Amichevole"/"Socio") —
   * derivabile ESATTAMENTE da GameDoc.wasFriendDuel (uno scalare, non un conteggio sull'eventLog),
   * stesso principio di wins/losses. */
  friendDuelsPlayed: number;
  /** Vittorie contro un amico (Achievements, "Rivale") — sottoinsieme di friendDuelsPlayed sopra,
   * stesso rapporto di wins verso gamesPlayed. */
  friendDuelWins: number;
  /** Scudo totale guadagnato (Achievements, "In difesa"/"In guardia"/"La muraglia") — somma degli
   * `amount` di ogni evento `shieldGained` nell'eventLog, stesso principio di damageDealt/
   * healingDone (derivato dal log, non uno scalare esatto come currentWinStreak). */
  shieldsGained: number;
  /** Scudo totale rimosso all'avversario (Achievements, "Spezzadifese"/"Distruttore") — somma degli
   * `amount` EFFETTIVI di ogni evento `shieldRemoved` (v. GameLogEntryData): pochi incantesimi lo
   * fanno (Frattura toglie un fisso, Breccia azzera tutto lo scudo presente qualunque esso sia), ma
   * contare il valore rimosso invece delle volte in cui l'incantesimo è stato lanciato resta
   * comunque possibile perché ogni rimozione logga la quantità reale, non quella nominale. */
  shieldsRemoved: number;
  /** Congelamento applicato all'avversario (Achievements, "...della neve"/"...del ghiaccio") — somma
   * degli `amount` di ogni evento `freezeApplied` nell'eventLog (il valore NOMINALE dell'incantesimo,
   * v. game-log.model.ts), stesso principio di damageDealt/healingDone sopra. */
  freezeApplied: number;
  /** Veleno applicato all'avversario (Achievements, "l'avvelenatore"/"...della Pestilenza") — somma
   * degli `amount` di ogni evento `poisonApplied` nell'eventLog (il valore NOMINALE dell'incantesimo,
   * non il livello netto risultante su PlayerTokens.poison che ha un tetto — v. game-log.model.ts). */
  poisonApplied: number;
  /** Volte in cui ogni elemento è stato ottenuto — chiave `Element` (v. element.model.ts), stesso
   * schema di `spellCastCounts` sopra (mappa libera, esclusa da `ObjectiveMetric`). Un solo contatore
   * per DUE fonti diverse a seconda del tier: i base (fuoco/acqua/aria/terra) si raccolgono in
   * Raccolta (`GameLogEntryData.cardCollected`, mai il risultato di una combinazione), tutto il resto
   * (avanzati/potenti/residuo) nasce sempre da una combinazione (`GameLogEntryData.combined`, mai
   * pescato dalla Fonte comune) — le due fonti non si sovrappongono mai per lo stesso elemento, un
   * solo contatore basta. Alimenta sia "Oscuro"/"Oscura"/"Luminoso"/"Luminosa" (soglia 5 su
   * dark/light) sia le 11 "Variante 'Elemento X'" (soglia 25, una per `COLLECTIBLE_ELEMENT_IDS`). */
  elementsObtained: Record<string, number>;
  /** Mana totale speso lanciando incantesimi (Achievements, "Spendaccione"/"Spendacciona"/
   * "Spendaccion*" e variante "Mana (V1)") — somma del `manaCost` (data/spells.ts) di ogni evento
   * `spellCast` nell'eventLog, stesso principio di damageDealt/healingDone (derivato dal log, non
   * uno scalare esatto come currentWinStreak). Diverso da `cardsCollected`: quello conta le carte
   * mana RACCOLTE in Raccolta, questo il mana SPESO lanciando incantesimi — due direzioni opposte
   * dello stesso pseudo-elemento (v. Element.mana in element.model.ts). */
  manaConsumed: number;
  /** Pattern di composizione mazzo combaciati (Achievements, es. "Che tutto vede") — mappa libera
   * CardPatternId -> 1, stesso schema di `spellCastCounts`/`elementsObtained` sopra (esclusa da
   * `ObjectiveMetric`, che espone invece `pattern_<id>` come proiezione scalare). Valutata sullo
   * stato FINALE della partita (v. game/achievements.ts computeCardPatternMatches), non
   * sull'eventLog. */
  cardPatternMatches: Record<string, number>;
  /** Volte in cui hai trattenuto un elemento alla punta della bacchetta (Achievements, "Previdente"/
   * "Lungimirante") — derivato da `GameLogEntryData.wandTipHeld` (già loggato per il Log di gioco,
   * mai letto da nessun achievement prima d'ora), stesso principio di `shieldsGained`. */
  tipHeld: number;
  /** Volte in cui hai incastonato un elemento nell'ASTA della bacchetta (Achievements, "Temprato/
   * Temprata/Tempr*"/"Inespugnabile") — derivato da `GameLogEntryData.wandSocketed` con
   * `slot === 'body'`. Al massimo 1 per partita (lo slot si riempie una sola volta, mai
   * sovrascrivibile — v. `socketElement` in `turn-engine.ts`). */
  bodySocketed: number;
  /** Come `bodySocketed` sopra ma per il MANICO (Achievements, "Incantato/Incantata/Incantat*"/
   * "Magnetico/Magnetica/Magnetic*") — `GameLogEntryData.wandSocketed` con `slot === 'handle'`. */
  handleSocketed: number;
  /** Vittorie in cui l'ultimo danno inflitto all'avversario è stato Veleno (Achievements, "Vipera")
   * — derivato guardando l'ULTIMA voce `damage` sul perdente nell'eventLog di una partita vinta
   * (`DamageLogSource.kind === 'poison'`, v. `wonWithPoisonFinish` in `game/achievements.ts`). Al
   * massimo 1 per partita: la vittoria si decide subito dopo ogni reducer (`resolveVictory`), quindi
   * quella voce è per forza il colpo letale, non una tra tante. */
  poisonFinishWins: number;
  /** Volte in cui la TUA bacchetta ha ridotto un danno che stavi per subire, da qualunque fonte
   * (Achievements, "Corazzato/Corazzata/Corazzat*"/"Indistruttibile") — derivato da
   * `GameLogEntryData.wandResistanceTriggered` con `outcome === 'resisted'` (qualunque
   * `selfInflicted`). `selfDamageResisted` sotto ne è un sottoinsieme (solo `selfInflicted`), non un
   * contatore indipendente: ogni volta che scatta "Infernale" conta ANCHE qui. */
  wandDamageResisted: number;
  /** Sottoinsieme di `wandDamageResisted` sopra: solo i danni AUTO-inflitti ridotti dalla propria
   * Resistenza (Achievements, "Infernale") — oggi possibile solo con Fiamma Nera, l'unico
   * incantesimo con `damage_self`. A differenza di `wandDamageResisted`, non richiede una soglia
   * alta: basta che sia successo una volta. */
  selfDamageResisted: number;
  /** Vittorie in cui, in qualunque momento della partita, la TUA Vulnerabilità ha aumentato un danno
   * AUTO-inflitto (Achievements, "Temerario/Temeraria/Temerari*", "Non temo nulla") — derivato da
   * `wonWithSelfVulnerable` in `game/achievements.ts` (`GameLogEntryData.wandResistanceTriggered`,
   * `outcome === 'vulnerable' && selfInflicted`). Al massimo 1 per partita, come
   * `poisonFinishWins`: qui non serve l'ULTIMA occorrenza (a differenza di quello), ma il "+1" resta
   * comunque legato all'ESITO della partita (vinta), non al numero di volte in cui è successo. */
  selfVulnerableWins: number;
}

export const EMPTY_USER_STATS: UserStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  cardsCollected: 0,
  combinationsMade: 0,
  spellsCast: 0,
  spellCastCounts: {},
  damageDealt: 0,
  healingDone: 0,
  currentWinStreak: 0,
  friendDuelsPlayed: 0,
  friendDuelWins: 0,
  shieldsGained: 0,
  shieldsRemoved: 0,
  freezeApplied: 0,
  poisonApplied: 0,
  elementsObtained: {},
  manaConsumed: 0,
  cardPatternMatches: {},
  tipHeld: 0,
  bodySocketed: 0,
  handleSocketed: 0,
  poisonFinishWins: 0,
  wandDamageResisted: 0,
  selfDamageResisted: 0,
  selfVulnerableWins: 0,
};
