# Duels

Changelog dettagliato (tutto ciò che è già stato fatto) archiviato in [documentation/todo-archive-2026-07-21.md](documentation/todo-archive-2026-07-21.md) — qui restano solo i punti ancora aperti.

## Qualità della vita

- [x] Loader alla board per il refresh.
- [x] Log eventi (azioni/danni/scarti consultabile a schermo).
- [x] Rivedere opzioni profilo utente — la dialog profilo è ferma alla v1 (nome, foto, dorso, elimina account); da rivedere/espandere.
- [x] Sfondo app e duello personalizzabili — permettere all'utente di scegliere/personalizzare lo sfondo dell'applicazione e quello della board di duello.
- [x] Conteggio turno anzichè "Turno di: nome-giocatore";
- [x] Magie preferite — un modo per il giocatore di segnare alcuni incantesimi come preferiti.
- [x] Magie pinnabili con tooltip in duel UI — poter "appuntare" un incantesimo durante il duello con un tooltip a schermo, per riferimento rapido senza dover riaprire il Grimorio. La stessa icona bookmark compare sugli elementi necessari a queste formule.
- [x] Regolamento — manca una pagina di glossario e una di glossario icone. Inoltre va controllato che tutto sia in linea con quanto sviluppato. Potrebbe essere anche bello includere le immagini di qualche carta per essere più esplicativi.
- [x] Amicizie - implementare aggiunta/rimozione amici.
- [x] Codici riscatto — dorsi carta sbloccabili tramite codice (`codes/{CODICE}` su Firestore, scrivibile solo da console/CLI, mai dal client), dialog "Riscatta codice" con anteprima del dorso sbloccato. Nella dialog profilo, il picker dorso è ora un componente a sé (`CardBackPickerComponent`, stesso schema selezione+Applica di `BackgroundPickerComponent` — niente più scritture su Firestore a ogni click), con griglia che va a capo e scorrimento indipendente per liste lunghe di dorsi. Corretto anche il dorso dell'avversario in game (mazzo, scarti, mano coperta): appariva identico al proprio invece che capovolto come se rivolto verso di lui.
- [x] Mana, seleziona tutto quando lanci una magia.
- [ ] Varianti carte — l'utente potrà scegliere le varianti delle carte in gioco. Abbiamo due set completi di elementi: permettiamo all'utente di usare il suo preferito.
- [x] Collezione — nuova pagina (`/collection`) con dorsi/sfondi/titoli posseduti (varianti carte escluse, quella feature non esiste ancora — v. sezione "Achievements" sotto).
- [x] Correggere il modo in cui si svuotano le barre della vita: da invertire per giocatore e avversario.
- [x] Il comando "Crea" del grimorio diventa "Apprendi";
- [x] Condizione di vittoria (1.3) — il motore non determinava mai un vincitore (`GameState.winner` non veniva mai assegnato, `surrender()` portava lo status a `finished` senza deciderlo, la pagina risultato mostrava sempre l'esito neutro). Scoperto lavorando alla base dati stats per gli achievements: qualunque contatore vinci/perdi dipendeva da un campo mai popolato. Ora `resolveVictory`/`isGameOver` (`turn-engine.ts`) sono applicate centralmente da `GameEngineService.mutate()` dopo ogni reducer (hp <= 0 → vince l'altro); `surrender()` si è spostato da `GameService` a `GameEngineService` (ora fissa anche `winner`, non solo lo status); pareggio (entrambi <= 0 nello stesso reducer) resta senza winner, il regolamento non lo prevede.

## Achievements (obiettivi e ricompense)

Bozza obiettivi/ricompense in [documentation/achievements_ideas.md](documentation/achievements_ideas.md) — prime idee, da rifinire strada facendo.

Ordine di sviluppo consigliato (ogni punto dipende dal precedente):

- [x] Schema dati stats utente — `UserStats`/`EMPTY_USER_STATS` in `user.model.ts` (contatori cumulativi lifetime: vittorie, sconfitte, carte raccolte in Raccolta, combinazioni, incantesimi lanciati totali e per-incantesimo, danno/cura totali), aggiornati come delta calcolato dall'`eventLog` della partita appena conclusa.
- [x] Regole Firestore per l'integrità degli stats (`statsValid()` in `firestore.rules`) — pattern simile a `redeemGrantValid()` ma con un limite reale scoperto durante l'audit: le regole non contano occorrenze in `eventLog` (niente filtri/lambda su array), quindi solo partite giocate/vittorie/sconfitte sono validate ESATTAMENTE (dal solo `state.winner`), il resto solo per PLAUSIBILITÀ (delta non negativo, tetto largo). **Rischio accettato consapevolmente**: il guardiano anti-replay (`users/{uid}/countedGames/{gameId}`) blocca il replay solo attraverso il client reale, non è una garanzia crittografica (le regole non possono obbligare due scritture su documenti diversi ad avvenire insieme) — un client scritto ad hoc potrebbe gonfiarsi i propri stats, confinato al proprio account, ricompense cosmetiche. Una vera garanzia richiederebbe una Cloud Function (rimandata deliberatamente, prima volta che questo progetto ne avrebbe bisogno). Dettagli nei commenti di `firestore.rules`/`user.model.ts`.
- [x] `OBJECTIVE_CATALOG` (`data/objectives.ts`, mirror di `SPELL_CATALOG`) — ogni obiettivo come `metric + soglia + ricompensa` (`models/objective.model.ts`), non un campo dedicato per obiettivo. Contenuto dei reward (quale sfondo/titolo per quale obiettivo) volutamente **placeholder** (`reward.id: 'TODO_...'`) — solo struttura per ora, i contenuti reali arriveranno quando decisi (sfondi quando gli asset in lavorazione saranno ottimizzati e in `backgrounds.json`, titoli quando scelto il testo). Badge esclusi dal tipo `ObjectiveRewardType` (nessuna idea concreta al momento).
- [x] Estendere `UserProfile` per le nuove ricompense — `unlockedBackgrounds`, `title`/`unlockedTitles`, stesso schema equip+owned di `cardBack`/`unlockedCardBacks`; regole Firestore `backgroundValid()`/`titleValid()` (i 4 sfondi esistenti restano sempre gratuiti, solo quelli futuri saranno gated). **Varianti carte rimandate**: la selezione variante in sé non esiste ancora (è il punto "Varianti carte" ancora aperto in Qualità della vita) — aggiungere `unlockedCardVariants` ora significherebbe indovinare uno schema per una feature non ancora progettata, va ripreso insieme a quel punto.
- [x] Servizio di valutazione obiettivi a fine partita — `game/achievements.ts` (puro: `computeStatsDelta`/`applyGameStatsDelta`/`newlyCompletedObjectives`/`buildObjectiveProgress`, stesso spirito di `turn-engine.ts` vs `game-engine.service.ts`) + `AuthService.applyGameStats(gameDoc, role)` (Firestore I/O: scrive `stats`/`lastStatsGameId`/`completedObjectiveIds` + marker `countedGames/{gameId}` in un solo `writeBatch`). Chiamato da `ResultComponent` (un `effect()` nel costruttore) appena partita+ruolo sono noti — no-op sicuro da rieseguire (il marker lo impedisce). **Gap di integrità chiuso**: `AuthService.claimObjective(objectiveId)` + `claimValid()`/`claimGrantValid()` in `firestore.rules` validano che `claimedObjectiveIds ⊆ completedObjectiveIds` e che `unlockedBackgrounds`/`unlockedTitles` crescano solo insieme a un riscatto vero (max +1 a scrittura) — **lo stesso audit ha trovato e chiuso anche un gap gemello preesistente** su `redeemGrantValid()` (riscatto codice): validava solo che l'id sbloccato fosse presente in `unlockedCardBacks`, non che l'array non ne contenesse altri smerciati di soppiatto nella stessa scrittura.
- [x] UI fine partita — colonna achievement sulla pagina risultato (`ObjectiveCardComponent`, riusato anche dalla pagina Obiettivi): barra di progresso, si illumina quando completato, bottone "Riscatta" quando completato e non ancora riscattato.
- [x] Pagina Obiettivi (`/objectives`) — l'intero catalogo con il progresso dell'utente, stesso componente della colonna fine partita.
- [x] Pagina profilo pubblica (`/profile/:uid`) — raggiungibile dal proprio menu ("Il mio profilo") e da ogni riga della lista amici ("Vedi profilo"); mostra titolo (se sbloccato) + stats riassuntive. Nessuna distinzione tra "non amico" e "uid inesistente" in caso di lettura negata (stesso stato `notFound`), per non far scoprire a chi indovina un uid a caso se esiste davvero.

Effetto collaterale scoperto costruendo il servizio di valutazione: `cardsCollected` (carte raccolte in Raccolta) non aveva NESSUNA voce nell'`eventLog` da cui derivarlo (a differenza di incantesimi/combinazioni/danno/cura, già tutti loggati) — aggiunta una nuova voce `cardCollected` (solo su `keepCard`, non su `keepMana`: nessuna carta vera entra nel mazzo in quel caso) apposta per questo. Esclusa di proposito dalla vista del Log di gioco (`GameLogDialogComponent`, troppo frequente — una volta a turno — per essere un evento "notevole" lì).

Casi limite ancora aperti (non bloccanti):
- `GameState.eventLog` è tagliato alle ultime 50 voci (v. `game.model.ts`) — rischio per obiettivi "dentro una singola partita" tipo "congela l'avversario 10 volte in un duello" se la partita è molto lunga. Nessun obiettivo di questo tipo è ancora nel catalogo (v. sotto), quindi non ancora un problema concreto.
- Alcune condizioni sono transitorie e non loggate oggi (avere in mano contemporaneamente i 3 incantesimi di rivelazione, avere ogni elemento base/avanzato/potente nel mazzo insieme) — richiedono una nuova log entry in `turn-engine.ts` nel momento in cui si verificano, non sono derivabili a posteriori. Non ancora nel catalogo per lo stesso motivo.
- Login 7 giorni consecutivi è un meccanismo indipendente dalle partite (streak su data ultimo login), non passa dall'`eventLog`.
- "Duello con un amico" richiede sapere se host e guest erano amici al momento della partita — oggi non registrato su `GameDoc`.
- `completedObjectiveIds`/`claimedObjectiveIds`/`unlockedBackgrounds`/`unlockedTitles` sono validati per struttura/monotonia/tetti di crescita (v. `firestore.rules`), ma NON verificano che l'id riscattato corrisponda davvero al reward di QUELL'obiettivo in `OBJECTIVE_CATALOG` — richiederebbe incorporare l'intero catalogo nelle regole. Stesso rischio accettato consapevolmente di `statsPlausible()`.
- `OBJECTIVE_CATALOG` (`data/objectives.ts`) copre solo gli obiettivi che le `UserStats` attuali sanno misurare (vittorie/sconfitte/partite giocate/carte raccolte/combinazioni/incantesimi lanciati/danno/cura) — tutti gli obiettivi "dentro una partita" o "transitori" della bozza in `documentation/achievements_ideas.md` restano fuori finché non si risolvono i due punti sopra.
- Contenuto reward ancora tutto placeholder (`reward.id: 'TODO_...'`) — da rifinire insieme quando decisi sfondi/titoli reali.

## Future espansioni (idee da valutare)

- **`element_immunity`** — unico `SpellEffectType` del catalogo non ancora risolto, rimandato deliberatamente: richiede un vero sistema di stati a scadenza sul giocatore (non sulla singola carta, come `Card.expiresAt`), oggi inesistente. Da riprendere con una futura espansione dedicata, "Status e magie continue".
- **Paura** - nuovo effetto assieme a Veleno e Congelamento che può essere applicato al bersaglio. Nella fase preparazione, per ogni segnalino paura (max 3) viene scartata 1 carta. L'effetto si riduce di 1 durante la preparazione (dopo aver applicato l'effetto) oppure si riduce per intero dopo aver applicato l'effetto (da valutare).
- **Scuole di magia** - dare una categoria alle magie consentirebbe di creare formule più diversificate pur mantenendo lo stesso effetto oltre a creare un nuovo elemento che può essere coinvolto negli effetti degli incantesimi (es. +1 danno alle magie di Elementalismo). Associato a questa novità potrebbero essere inclusi gli "Equipaggiamenti", l'unico modo per diversificare un giocatore dall'altro.
- **Rituali** - Magie che una volta lanciate hanno effetto ogni turno.
- **Evocazioni** - Magie più potenti che vanno lanciate e poi potenziate per ottenere un effetto nel futuro.

## Future implementazioni

- **Bot di debug più capace** — l'`effect()` in `board.component.ts` che fa avanzare da solo l'avversario di debug (`guestId 'debug-guest'`) si limita ad attraversare le fasi a raffica: non raccoglie, non combina, non lancia magie. Non è quindi un vero test del turno avversario, ma solo un modo per non restare bloccati sul suo turno mentre si gioca da soli. Rimandato deliberatamente: basterebbe collegare i reducer già esistenti in `turn-engine.ts` (`collectCard`, `combine*`, `castSpell`) con scelte casuali/euristiche (stima: mezza giornata), ma finché è possibile far testare a persone vere non è prioritario. Da riprendere se servirà un secondo attore automatico per test/regressioni ripetibili.

## Da valutare

- Valutare "scarta invece di subire danno" come alternativa al danno automatico dell'esplosione elementale, se il playtest lo suggerisce.
- Tematizzare meglio `damage_self` (oggi usato solo da `black_flame`) quando arriveranno le scuole di magia come categoria narrativa.
- [ ] Tooltip Giocatore con preview del profilo in Duello. Da implementare quando avremo elementi di personalizzazione del profilo più ricchi (es. sfondo, dorso, ecc.).
