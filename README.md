# Duels

Changelog dettagliato (tutto ciò che è già stato fatto) archiviato in [documentation/todo-archive-2026-07-21.md](documentation/todo-archive-2026-07-21.md) e [documentation/todo-archive-2026-08-04.md](documentation/todo-archive-2026-08-04.md) — qui restano solo i punti ancora aperti, ordinati per complessità.

## Prossimi passi (in ordine di complessità)

### Bassa complessità

- [x] Dorso **books** — asset già pronto (`public/cards-back/books.webp`), manca solo creare il documento `codes/b00ks2024` su Firestore (console/CLI, mai dal client) per iniziare a distribuire il codice.
- [ ] Tooltip Giocatore con preview del profilo in Duello — rimandato finché mancavano "elementi di personalizzazione più ricchi"; ora che sfondo/dorso/titolo esistono davvero, la precondizione è soddisfatta.

### Media complessità

- [ ] Bot di debug più capace — l'`effect()` in `board.component.ts` che fa avanzare da solo l'avversario di debug (`guestId 'debug-guest'`) si limita ad attraversare le fasi a raffica: non raccoglie, non combina, non lancia magie. Basterebbe collegare i reducer già esistenti in `turn-engine.ts` (`collectCard`, `combine*`, `castSpell`) con scelte casuali/euristiche (stima: mezza giornata). Non prioritario finché è possibile far testare a persone vere.
- [ ] Obiettivi stagionali (dorso **summer**) — pensati come "gioca N partite in un periodo"/eventi di stagione: `OBJECTIVE_CATALOG`/`Objective.metric` supportano oggi solo soglie cumulative lifetime, non finestre temporali — serve un tipo di obiettivo nuovo prima che possano davvero sbloccarsi. N e i periodi restano da decidere. Lo sfondo **amber** è uscito da questo bucket (riassegnato a `collect_500`, v. archivio).

### Medio-alta complessità

- [ ] Acquisto sostenitori (dorso **founder** + sfondo **founder**) — nessun flusso di pagamento esiste in questo progetto oggi. Mostrati in Collezione come "sarà disponibile", non collegati a nessun meccanismo reale finché non si deciderà come implementarlo (provider di pagamento, verifica lato server, ecc.).

### Alta complessità (serve prima una decisione di design, poi codice cross-sistema)

- [ ] **Status e magie continue** — sistema di stati a scadenza sul *giocatore* (non sulla singola carta, come oggi `Card.expiresAt`). Sbloccherebbe `element_immunity` (unico `SpellEffectType` del catalogo non ancora risolto) e probabilmente è un prerequisito naturale anche per **Paura** (nuovo effetto sul modello di Veleno/Congelamento: ogni segnalino, max 3, forza lo scarto di 1 carta in Preparazione; se il segnalino si riduce subito dopo o solo a fine effetto è da decidere).
- [ ] **Scuole di magia** — dare una categoria alle formule (es. Elementalismo) permetterebbe magie meccanicamente diverse pur riusando gli stessi effetti, aprirebbe un nuovo elemento coinvolgibile negli effetti (es. +1 danno alle magie di quella scuola) e darebbe finalmente un aggancio narrativo a `damage_self` (oggi usato solo da `black_flame`). Propedeutico agli **Equipaggiamenti**, l'unico modo ipotizzato finora per differenziare un giocatore dall'altro oltre al mazzo.
- [ ] **Rituali** — magie che, una volta lanciate, hanno effetto ogni turno.
- [ ] **Evocazioni** — magie più potenti lanciate e poi potenziate nel tempo per ottenere un effetto futuro.

## Monetizzazione — Sistema Energia (idea futura)

Modello di sostenibilità leggero ispirato a Duolingo — niente banner ads, niente pay-to-win. Target realistico: coprire i costi infrastrutturali (~10€/mese), non un business scalabile.

- [ ] **Energia disaccoppiata dal matchmaking** (principio cardine) — l'energia non deve mai bloccare la possibilità di giocare, solo il salvataggio dei progressi post-partita: in un 1v1 puro, un giocatore senza energia non deve poter impedire anche all'avversario di giocare.
- [ ] **Meccanica energia** — costo 1 per creare/unirsi a un duello; energia base 5, ricarica temporizzata (durata da bilanciare). A energia 0 il matchmaking resta comunque aperto, ma prima di entrare in coda il giocatore riceve un avviso esplicito: la partita si gioca normalmente, i progressi a fine duello non verranno salvati.
- [ ] **Simmetria host/guest** — stesso costo, stesse conseguenze per chi crea e per chi si unisce: nessun incentivo perverso ad "aspettare che sia sempre l'altro a pagare". Chi ha già energia non percepisce alcuna differenza, indipendentemente dallo stato energia dell'avversario.
- [ ] **Opzioni a energia 0** (mostrate nell'avviso pre-match) — video pubblicitario rewarded per +1 energia (opt-in, mai forzato, mai banner/interstitial tra i turni), acquisto energia dal negozio, oppure procedere comunque sapendo che i progressi non si salveranno.
- [ ] **Modello economico** — ricarica temporizzata gratuita + rewarded ad opt-in per ricariche singole + acquisto energia a negozio + acquisto una tantum "rimuovi pubblicità" (prezzo più alto). Cosmetics e season pass restano il motore primario delle entrate; energia/ads è un tassello complementare, a costo marginale zero per chi non vuole spendere.
- [ ] **Matchmaking — nota architetturale collegata** — niente lista di lobby browsabile (troppo overhead UI/Firestore per un 1v1 dove la maggior parte vuole solo "fammi giocare ora"): sostituita da una coda semplice, match automatico sul primo disponibile in attesa. Eventuale contatore leggero "giocatori in attesa" al posto dei dettagli delle singole partite, se si vuole dare percezione di attività senza i costi di una lista vera. Il flusso amici/sfida diretta (lobby con invito/codice) resta separato, non tocca questa logica.
- [ ] **Bilanciamento da playtest** (non decidibile ora) — durata della ricarica energia; quanti duelli/giorno fa un giocatore medio (dato reale mancante); importi del negozio (prezzo ricarica, prezzo rimozione ads); se estendere in futuro il costo energia anche a modalità single-player (tutorial/sfide, oggi non pianificate) — da trattare come feature/pacchetto separato, non qui.

## Rischi noti (accettati, non bloccanti)

Dettagli completi in [documentation/todo-archive-2026-08-04.md](documentation/todo-archive-2026-08-04.md#caveat-noti-accettati-non-bloccanti):

- `GameState.eventLog` tagliato alle ultime 50 voci — rischio per futuri obiettivi "dentro una singola partita" molto lunga.
- Le regole Firestore validano struttura/monotonia/tetti di crescita di `completedObjectiveIds`/`unlockedCardBacks`/`unlockedBackgrounds`/`unlockedTitles`, ma non che gli id riscattati corrispondano davvero al reward di quell'obiettivo in `OBJECTIVE_CATALOG`.
