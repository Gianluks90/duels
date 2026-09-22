# Duels

Changelog dettagliato (tutto ciò che è già stato fatto) archiviato in [documentation/todo-archive-2026-07-21.md](documentation/todo-archive-2026-07-21.md) e [documentation/todo-archive-2026-08-04.md](documentation/todo-archive-2026-08-04.md) — qui restano solo i punti ancora aperti, ordinati per complessità.

## Prossimi passi (in ordine di complessità)

### Bassa complessità

- [x] Dorso **books** — asset già pronto (`public/cards-back/books.webp`), manca solo creare il documento `codes/b00ks2024` su Firestore (console/CLI, mai dal client) per iniziare a distribuire il codice.
- [x] **Sistema Emote (modello + Collezione)** — 6 categorie fisse ispirate a Hearthstone/MTG Arena (Saluto/Provocazione/Complimenti/Grazie/Scusa/Ops), catalogo `EMOTE_CATALOG` con lo stesso pattern catalogo+equip di dorsi/sfondi (`src/app/data/emotes.ts`), sezione "Emotes" funzionante in Collezione — tutto dietro `EMOTES_FEATURE_ENABLED` (`false`), non ancora visibile ai giocatori durante il beta test. Riscatto codice esteso per accreditare più ricompense insieme in un solo codice (dorso + emote, v. `documentation/adding-collectibles.md`); pacchetto a tema "da programmatore" (6 frasi) già pronto per il codice che sblocca anche il dorso `de-bug`. Manca ancora lo strumento per INVIARLE durante una partita, v. Media complessità sotto.
- [ ] Tooltip Giocatore con preview del profilo in Duello — rimandato finché mancavano "elementi di personalizzazione più ricchi"; ora che sfondo/dorso/titolo esistono davvero, la precondizione è soddisfatta.

### Media complessità

- [ ] **Strumento "invia emote" nella UI di Duello** — il modello e la Collezione esistono già (v. Bassa complessità sopra, dietro `EMOTES_FEATURE_ENABLED`), ma non c'è ancora nessun bottone/ruota in `board.component.ts` per scegliere una categoria e inviare la propria emote equipaggiata all'avversario durante la partita. Serve anche: un canale di consegna (es. un evento transiente sul `GameDoc`, non nello `state` persistito — non deve finire nell'`eventLog`/negli stats), la UI di visualizzazione lato ricevente (bolla/testo sopra l'avatar avversario), e un cooldown anti-spam (v. nota "squelch" di Hearthstone in `documentation/adding-collectibles.md`, `UserProfile.mutedEmotesFrom` già previsto nel modello ma non applicato). Va inoltre deciso se questo strumento va acceso PRIMA o insieme a `EMOTES_FEATURE_ENABLED` per il pubblico.
- [ ] Bot di debug più capace — l'`effect()` in `board.component.ts` che fa avanzare da solo l'avversario di debug (`guestId 'debug-guest'`) si limita ad attraversare le fasi a raffica: non raccoglie, non combina, non lancia magie. Basterebbe collegare i reducer già esistenti in `turn-engine.ts` (`collectCard`, `combine*`, `castSpell`) con scelte casuali/euristiche (stima: mezza giornata). Non prioritario finché è possibile far testare a persone vere.
- [ ] Obiettivi stagionali (dorso **summer**) — pensati come "gioca N partite in un periodo"/eventi di stagione: `OBJECTIVE_CATALOG`/`Objective.metric` supportano oggi solo soglie cumulative lifetime, non finestre temporali — serve un tipo di obiettivo nuovo prima che possano davvero sbloccarsi. N e i periodi restano da decidere. Lo sfondo **amber** è uscito da questo bucket (riassegnato a `collect_500`, v. archivio).

### Medio-alta complessità

- [ ] Acquisto sostenitori (dorso **founder** + sfondo **founder**) — nessun flusso di pagamento esiste in questo progetto oggi. Mostrati in Collezione come "sarà disponibile", non collegati a nessun meccanismo reale finché non si deciderà come implementarlo (provider di pagamento, verifica lato server, ecc.).

### Alta complessità (serve prima una decisione di design, poi codice cross-sistema)

- [ ] **Status e magie continue** — sistema di stati a scadenza sul _giocatore_ (non sulla singola carta, come oggi `Card.expiresAt`). Sbloccherebbe `element_immunity` (unico `SpellEffectType` del catalogo non ancora risolto) e probabilmente è un prerequisito naturale anche per **Paura** (nuovo effetto sul modello di Veleno/Congelamento: ogni segnalino, max 3, forza lo scarto di 1 carta in Preparazione; se il segnalino si riduce subito dopo o solo a fine effetto è da decidere).
- [ ] **Scuole di magia** — dare una categoria alle formule (es. Elementalismo) permetterebbe magie meccanicamente diverse pur riusando gli stessi effetti, aprirebbe un nuovo elemento coinvolgibile negli effetti (es. +1 danno alle magie di quella scuola) e darebbe finalmente un aggancio narrativo a `damage_self` (oggi usato solo da `black_flame`). Propedeutico agli **Equipaggiamenti**, l'unico modo ipotizzato finora per differenziare un giocatore dall'altro oltre al mazzo.
- [ ] **Rituali** — magie che, una volta lanciate, hanno effetto ogni turno.
- [ ] **Evocazioni** — magie più potenti lanciate e poi potenziate nel tempo per ottenere un effetto futuro.

## Setup Partita — UI e collegamento 1:1 (prossimo focus)

Prima di un vero matchmaking automatico, il focus è sistemare la UI di preparazione partita e il collegamento diretto host/guest via codice stanza. In ordine di complessità:

- [ ] **Sidenav di preparazione partita** — nessuna route dedicata al setup: al suo posto una semplice animazione di due sidenav (una per giocatore) che si chiudono verso il centro dello schermo. Finché l'avversario non si è collegato, la sua side mostra un placeholder (icona ignota, nessun nome/titolo); una volta collegato i placeholder vengono sostituiti dai dati reali. In basso su ogni side il tasto "Pronto" (disabilitato finché l'avversario non è collegato).
  - Le sidenav vivono a un livello più alto del router-outlet della pagina di gioco: il cambio pagina non deve essere visibile, la loro apertura rivela la pagina del duello che nel frattempo si è preparata sotto.
- [ ] **Fase "avversario sconosciuto" — condivisione codice** — quando un giocatore crea una nuova partita le side si chiudono ma l'avversario è ancora un placeholder: al centro, in verticale tra le due side, si mostra il codice stanza da condividere. Se siamo noi il giocatore che deve unirsi, subito sotto il codice compare un input per incollare/inserire quel codice.
- [ ] **Collegamento host/guest e sblocco "Pronto"** — quando il guest incolla e conferma il codice la partita si collega (join reale, sostituisce/riusa `joinGame`): il placeholder lato host viene sostituito da icona/nome/titolo reali del guest, e solo a collegamento avvenuto il tasto "Pronto" passa da disabilitato a disponibile su entrambe le side.
- [ ] **Obiettivo finale: matchmaking automatico a coda** — nella versione finale la coda non è mai visibile all'utente: un tasto "Avversario casuale" mette il giocatore in coda in attesa che un altro giocatore selezioni la stessa opzione, e li accoppia automaticamente. Il flusso a codice (i tre punti sopra) resta comunque disponibile come via diretta/tra amici, separata da questa coda.

## Monetizzazione — Sistema Energia (idea futura)

Modello di sostenibilità leggero ispirato a Duolingo — niente banner ads, niente pay-to-win. Target realistico: coprire i costi infrastrutturali (~10€/mese), non un business scalabile.

- [ ] **Energia disaccoppiata dal matchmaking** (principio cardine) — l'energia non deve mai bloccare la possibilità di giocare, solo il salvataggio dei progressi post-partita: in un 1v1 puro, un giocatore senza energia non deve poter impedire anche all'avversario di giocare.
- [ ] **Meccanica energia** — costo 1 per creare/unirsi a un duello; energia base 5, ricarica temporizzata (durata da bilanciare). A energia 0 il matchmaking resta comunque aperto, ma prima di entrare in coda il giocatore riceve un avviso esplicito: la partita si gioca normalmente, i progressi a fine duello non verranno salvati.
- [ ] **Simmetria host/guest** — stesso costo, stesse conseguenze per chi crea e per chi si unisce: nessun incentivo perverso ad "aspettare che sia sempre l'altro a pagare". Chi ha già energia non percepisce alcuna differenza, indipendentemente dallo stato energia dell'avversario.
- [ ] **Opzioni a energia 0** (mostrate nell'avviso pre-match) — video pubblicitario rewarded per +1 energia (opt-in, mai forzato, mai banner/interstitial tra i turni), acquisto energia dal negozio, oppure procedere comunque sapendo che i progressi non si salveranno.
- [ ] **Modello economico** — ricarica temporizzata gratuita + rewarded ad opt-in per ricariche singole + acquisto energia a negozio + acquisto una tantum "rimuovi pubblicità" (prezzo più alto). Cosmetics e season pass restano il motore primario delle entrate; energia/ads è un tassello complementare, a costo marginale zero per chi non vuole spendere.
- [ ] **Bilanciamento da playtest** (non decidibile ora) — durata della ricarica energia; quanti duelli/giorno fa un giocatore medio (dato reale mancante); importi del negozio (prezzo ricarica, prezzo rimozione ads); se estendere in futuro il costo energia anche a modalità single-player (tutorial/sfide, oggi non pianificate) — da trattare come feature/pacchetto separato, non qui.

## Rischi noti (accettati, non bloccanti)

Dettagli completi in [documentation/todo-archive-2026-08-04.md](documentation/todo-archive-2026-08-04.md#caveat-noti-accettati-non-bloccanti):

- `GameState.eventLog` tagliato alle ultime 50 voci — rischio per futuri obiettivi "dentro una singola partita" molto lunga.
- Le regole Firestore validano struttura/monotonia/tetti di crescita di `completedObjectiveIds`/`unlockedCardBacks`/`unlockedBackgrounds`/`unlockedTitles`, ma non che gli id riscattati corrispondano davvero al reward di quell'obiettivo in `OBJECTIVE_CATALOG`.
