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
};
