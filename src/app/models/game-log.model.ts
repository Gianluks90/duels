import type { BaseElement, Element } from './element.model';
import type { PlayerId } from './player.model';

/** Causa di un `damage`: distingue un incantesimo (con nome), un'Esplosione elementale (2.4) o
 * l'Avvelenamento (2.3.4) — la cura invece porta sempre `spellId` direttamente (nessun'altra fonte
 * di cura esiste nel motore), non le serve un'unione. */
export type DamageLogSource =
  { kind: 'spell'; spellId: string } | { kind: 'explosion' } | { kind: 'poison' };

/**
 * Una voce del log eventi di gioco, senza `id` (assegnato da turn-engine.ts, appendLog) — union
 * discriminata separata da GameLogEntry sotto apposta: `Omit<GameLogEntry, 'id'>` non distribuirebbe
 * correttamente su un'unione (perderebbe i campi specifici di ogni variante, `keyof` su un'unione
 * intersecata restituisce solo le chiavi comuni a TUTTE le varianti), quindi la versione "senza id"
 * va definita così direttamente, non derivata con Omit.
 */
export type GameLogEntryData =
  | { type: 'damage'; role: PlayerId; amount: number; source: DamageLogSource }
  | { type: 'healed'; role: PlayerId; amount: number; spellId: string }
  | { type: 'shieldGained'; role: PlayerId; amount: number }
  /** Congelamento (2.3.1) sciolto in Preparazione — `count` carte, mai i dettagli delle singole
   * carte (sono "non-carte" senza identità rilevante per il log). */
  | { type: 'freezeResolved'; role: PlayerId; count: number }
  /** Carta tenuta in fase Raccolta (4.3, keepCard) — non emessa da keepMana (nessuna carta vera
   * entra nel mazzo in quel caso, v. turn-engine.ts). Serve solo a derivare `UserStats.cardsCollected`
   * a fine partita (AchievementsService), non è pensata per comparire nel dialog del log (troppo
   * frequente, una volta a turno) — GameLogDialogComponent la filtra esplicitamente dalla vista. */
  | { type: 'cardCollected'; role: PlayerId }
  | { type: 'spellCast'; role: PlayerId; spellId: string }
  | { type: 'spellCreated'; role: PlayerId; spellId: string }
  | {
      type: 'combined';
      role: PlayerId;
      kind: 'advanced' | 'superior' | 'residue';
      element: Element;
    }
  | { type: 'wandTipHeld'; role: PlayerId; element: BaseElement }
  | { type: 'wandSocketed'; role: PlayerId; slot: 'body' | 'handle'; element: BaseElement }
  /** Terzo occhio/Occhio supremo/Occhio arcano — `full` true solo per Occhio supremo (rivela
   * l'intera mano, `count` assente in SpellEffect.amount), altrimenti una rivelazione parziale. */
  | { type: 'handRevealed'; role: PlayerId; full: boolean }
  /** Raffica violenta (count carte)/Colpo basso (`full`, intera mano) — `role` è chi ha COSTRETTO
   * l'avversario a scartare (il lanciatore), non chi ha scartato. */
  | { type: 'opponentForcedDiscard'; role: PlayerId; count: number; full: boolean }
  | { type: 'fonteReset'; role: PlayerId };

/**
 * Una voce del log eventi di gioco (`GameState.eventLog`) — persistita su Firestore, condivisa tra i
 * due giocatori (entrambi vedono tutte le voci, di entrambi i ruoli). `role` è sempre chi ha compiuto
 * l'azione o subito l'effetto (mai un "bersaglio" implicito da dedurre): la UI (GameLogDialogComponent)
 * decide "tu"/nome dell'avversario confrontando `role` con il proprio ruolo al momento di renderizzare,
 * non qui — la stringa non viene mai composta lato reducer (turn-engine.ts), solo dati strutturati +
 * chiave i18n scelta a valle. `timestamp` (`Date.now()`, assegnato da appendLog) è solo un'etichetta
 * oraria in UI, mai usato per ordinare (l'ordine è già quello dell'array).
 */
export type GameLogEntry = GameLogEntryData & { id: string; timestamp: number };
