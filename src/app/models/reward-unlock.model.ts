/**
 * Come si sblocca un elemento di collezione (dorso/sfondo/titolo) con contenuto reale — condiviso
 * tra data/card-backs.ts e data/backgrounds.ts invece di due union identiche duplicate.
 */
export type RewardUnlock =
  | { kind: 'free' }
  | { kind: 'objective'; objectiveId: string }
  /** Sarà legato a un obiettivo, ma QUALE non è ancora stato deciso (a differenza di 'objective',
   * che punta già a un Objective.id reale in OBJECTIVE_CATALOG) — mai posseduto/equipaggiabile
   * finché resta in questo stato (nessun objectiveId da verificare, quindi nessun percorso di
   * sblocco reale). Mostrato comunque in Collezione con un messaggio esplicito ("Condizione di
   * sblocco non ancora disponibile"), non nascosto. Quando si deciderà l'obiettivo giusto, va
   * sostituito con `{ kind: 'objective', objectiveId: '...' }` — v. data/emotes.ts per l'uso
   * attuale (frasi aggiunte prima di decidere come sbloccarle). */
  | { kind: 'objectivePending' }
  /** Codice riscatto dedicato — il codice stesso non compare mai in UI (vanificherebbe il
   * riscatto); il documento `codes/{CODICE}` va creato manualmente da console/CLI Firebase. */
  | { kind: 'redeemCode' }
  /** Acquisto sostenitori — meccanismo non ancora implementato (nessun flusso di pagamento in
   * questo progetto oggi). Mostrato comunque in Collezione: il giocatore deve sapere che esiste. */
  | { kind: 'purchase' }
  /** Obiettivo stagionale (es. "gioca N partite in un periodo") — richiede un tipo di obiettivo a
   * finestra temporale che OBJECTIVE_CATALOG non supporta ancora (solo soglie cumulative lifetime,
   * v. Objective.metric). Mostrato comunque in Collezione: dettagli da decidere quando si
   * implementerà il meccanismo. */
  | { kind: 'seasonal' }
  /** Invitare un amico a giocare — meccanismo non ancora implementato (nessun collegamento tra
   * FriendsService/inviti e le ricompense oggi). Mostrato comunque in Collezione: il giocatore deve
   * sapere che esiste, dettagli (quale soglia, quale evento la sblocca davvero) da decidere quando
   * si implementerà il meccanismo. */
  | { kind: 'inviteFriend' }
  /** Riservato a UN account specifico (uid hardcoded) — non ottenibile in nessun altro modo, MAI
   * mostrato in Collezione a chi non è quello uid (a differenza degli altri kind, sempre visibili
   * come "da sbloccare"). Rimane comunque leggibile/visibile ovunque un titolo già equipaggiato si
   * mostri normalmente (profilo pubblico, in game) per chiunque guardi il profilo di quell'uid —
   * l'esclusività riguarda solo CHI PUÒ OTTENERLO, non chi può VEDERLO una volta equipaggiato. */
  | { kind: 'exclusive'; uid: string };
