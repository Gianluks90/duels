# Duels

Changelog dettagliato (tutto ciò che è già stato fatto) archiviato in [documentation/todo-archive-2026-07-21.md](documentation/todo-archive-2026-07-21.md) e [documentation/todo-archive-2026-08-04.md](documentation/todo-archive-2026-08-04.md) — qui restano solo i punti ancora aperti, ordinati per complessità.

## Prossimi passi (in ordine di complessità)

### Bassa complessità

- [x] Dorso **books** — asset già pronto (`public/cards-back/books.webp`), manca solo creare il documento `codes/b00ks2024` su Firestore (console/CLI, mai dal client) per iniziare a distribuire il codice.
- [ ] Reward ancora `TODO_...` — lo sfondo di `collect_500`/`combine_50` in `OBJECTIVE_CATALOG`, va solo deciso il contenuto (stesso processo usato per gli altri in `documentation/achievement-titles.md`).
- [ ] Tooltip Giocatore con preview del profilo in Duello — rimandato finché mancavano "elementi di personalizzazione più ricchi"; ora che sfondo/dorso/titolo esistono davvero, la precondizione è soddisfatta.

### Media complessità

- [ ] Bot di debug più capace — l'`effect()` in `board.component.ts` che fa avanzare da solo l'avversario di debug (`guestId 'debug-guest'`) si limita ad attraversare le fasi a raffica: non raccoglie, non combina, non lancia magie. Basterebbe collegare i reducer già esistenti in `turn-engine.ts` (`collectCard`, `combine*`, `castSpell`) con scelte casuali/euristiche (stima: mezza giornata). Non prioritario finché è possibile far testare a persone vere.
- [ ] Obiettivi stagionali (dorso **summer** + sfondo **amber**) — pensati come "gioca N partite in un periodo"/eventi di stagione: `OBJECTIVE_CATALOG`/`Objective.metric` supportano oggi solo soglie cumulative lifetime, non finestre temporali — serve un tipo di obiettivo nuovo prima che possano davvero sbloccarsi. N e i periodi restano da decidere.

### Medio-alta complessità

- [ ] Acquisto sostenitori (dorso **founder** + sfondo **founder**) — nessun flusso di pagamento esiste in questo progetto oggi. Mostrati in Collezione come "sarà disponibile", non collegati a nessun meccanismo reale finché non si deciderà come implementarlo (provider di pagamento, verifica lato server, ecc.).

### Alta complessità (serve prima una decisione di design, poi codice cross-sistema)

- [ ] **Status e magie continue** — sistema di stati a scadenza sul *giocatore* (non sulla singola carta, come oggi `Card.expiresAt`). Sbloccherebbe `element_immunity` (unico `SpellEffectType` del catalogo non ancora risolto) e probabilmente è un prerequisito naturale anche per **Paura** (nuovo effetto sul modello di Veleno/Congelamento: ogni segnalino, max 3, forza lo scarto di 1 carta in Preparazione; se il segnalino si riduce subito dopo o solo a fine effetto è da decidere).
- [ ] **Scuole di magia** — dare una categoria alle formule (es. Elementalismo) permetterebbe magie meccanicamente diverse pur riusando gli stessi effetti, aprirebbe un nuovo elemento coinvolgibile negli effetti (es. +1 danno alle magie di quella scuola) e darebbe finalmente un aggancio narrativo a `damage_self` (oggi usato solo da `black_flame`). Propedeutico agli **Equipaggiamenti**, l'unico modo ipotizzato finora per differenziare un giocatore dall'altro oltre al mazzo.
- [ ] **Rituali** — magie che, una volta lanciate, hanno effetto ogni turno.
- [ ] **Evocazioni** — magie più potenti lanciate e poi potenziate nel tempo per ottenere un effetto futuro.

## Rischi noti (accettati, non bloccanti)

Dettagli completi in [documentation/todo-archive-2026-08-04.md](documentation/todo-archive-2026-08-04.md#caveat-noti-accettati-non-bloccanti):

- `GameState.eventLog` tagliato alle ultime 50 voci — rischio per futuri obiettivi "dentro una singola partita" molto lunga.
- Le regole Firestore validano struttura/monotonia/tetti di crescita di `completedObjectiveIds`/`unlockedCardBacks`/`unlockedBackgrounds`/`unlockedTitles`, ma non che gli id riscattati corrispondano davvero al reward di quell'obiettivo in `OBJECTIVE_CATALOG`.
