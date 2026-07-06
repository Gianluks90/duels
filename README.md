# Duels

## TODO (storico)

Riorganizzata per priorità: prima le fondamenta da cui dipendono altri task, poi il gameplay core, poi i18n/opzioni, infine il profilo utente.

### 1. Quick win

- [x] Board: implementare un tasto che apra il Grimorio (dialog già esistente, manca solo il trigger).

### 2. Fondamenta (bloccano altri task sotto)

- [x] Implementare un tooltip generico di una larghezza fissa e altezza auto con opzioni per evocarlo a destra, sinistra, sopra o sotto l'elemento target — serve al punto 3.
- [x] Aggiornare l'elenco delle fasi della partita: attesa, preparazione, raccolta, azione, incantesimo, fine — serve al punto 3 (oggi il modello `TurnPhase` ha solo raccolta/azione/conclusione).

### 3. Gameplay core

- [x] Board / componente vita: le fasi non sono più un elenco ma viene mostrata solamente quella in corso; un tooltip mostra tutte le fasi in ordine con il pallino illuminato su quella attiva (dipende dai punti 2).
- [x] Tootlip sulle carte avanzate: mostra quali elementi vanno combinati per ottenere la carta;
- [x] Tooltip su mazzo del giocatore (anche avversario) con conteggio carte rimanenti;
- [x] Tooltip su scarti del giocatore (anche avversario) con conteggio carte scartate;
- [x] Board: Nuovo icon button con icona question_mark che apre la dialog del regolamento + tooltip "Regolamento" (dipende dal punto 1) sotto Grimorio;
- [x] Board / componente vita: gli hp di un giocatore non sono un numero fatto e finito ma un oggetto che comprende max, current, shield. Normalmente rossa, la barra si svuota in base ai danni subiti e il contenitore resta scuro sotto. Se ho un valore di shield >= 1 accanto al rosso compare una barra azzurra che rappresenta la vita aggiuntiva. Il riempimento non va oltre la barra ma deve essere calcolato perché rimanga tutto dentro di essa.
- [x] Includere e implementare nel progetto il menu del cdk per gestire le azioni.

### 4. Gameplay polish (a costo zero, si appoggia a quanto appena fatto al punto 3)

- [x] Correggere: NG02955: The NgOptimizedImage directive (activated on an <img> element with the `ngSrc="http://localhost:4200/cards/fire.png"`) has detected that this image is the Largest Contentful Paint (LCP) element but was not marked "priority". This image should be marked "priority" in order to prioritize its loading. To fix this, add the "priority" attribute. — bug fix isolato, zero dipendenze, buono da togliere di mezzo subito.
- [x] Hover su una carta della fonte arcana illumina gli eventuali componenti presenti nella mano in quel momento. Si illuminano di azzurro le carte se non ho la formula completa, si illuminano di oro se posso combinarne abbastanza per ottenere la carta della fonte arcana. Uguale su residuo arcano. — riusa la stessa logica "ho le carte in mano?" appena scritta per il menu Combina (punto 3), quindi conviene farlo ora finché è fresco.

### 5. i18n & opzioni

- [x] Implementare i18n per avere multilingua (italiano + inglese) con italiano come lingua principale — prioritario da fare prima che il testo in giro nell'app cresca ancora (retrofit più costoso più si aspetta). Infrastruttura pronta (TranslationService + pipe + dizionari JSON); copertura reale finora solo sulla dialog Opzioni, il resto dell'app va tradotto pagina per pagina.
- [x] Home / opzioni: aggiungere nelle opzioni una select per la lingua e un toggle per l'audio (la select lingua dipende da i18n sopra; il toggle audio presuppone un sistema audio non ancora esistente, quindi per ora è solo uno stub visivo).

### 6. Profilo utente

- [x] Home / utente: aggiungere il pallino con immagine dell'utente loggato e menu contestuale con dialog. Il menu contiene anche "Esci" (rimosso il bottone separato dall'header, ora ridondante).
- [x] Home / utente (dialog): opzioni disponibili: cambia nome visualizzato, url immagine personalizzata, scegli dorso (tra quelli disponibili / sbloccati), elimina account (dipende dal punto sopra; "elimina account" è distruttivo, va implementato con conferma esplicita). "Elimina account" spostato qui dalla dialog Opzioni (niente più duplicati, un solo posto per la gestione dell'account).

### Prossime implementazioni (non ancora pianificate)
- [ ] Log degli eventi con icon button su board (ogni azione del giocatore, ogni danno subito, ogni scarto, ecc. viene registrato in un log che può essere consultato in qualsiasi momento).
- [ ] Valutare come avviene la ricarica del mana (per ora fase raccolta scelgo tra pesco carta o ottengo mana - ma quanto?); — risolto concettualmente da [Regolamento v2](documentation/rulebook/v2/rules.md), vedi nuova lista sotto.
- [ ] Etichetta "Bacchetta comune" in box lungo quanto le tre sezioni;

## TODO — Motore di gioco (Regolamento v2)

Il regolamento è stato riscritto e finalizzato in [documentation/rulebook/v2/rules.md](documentation/rulebook/v2/rules.md). Il primo motore di turno reale è stato implementato secondo il piano in `.claude/plans/modular-cuddling-blanket.md` (nuovi `src/app/game/deck-builder.ts` e `src/app/game/turn-engine.ts`, più `src/app/services/game-engine.service.ts`): `board.component.ts` ora legge dati reali da Firestore invece di signal mock, e il bug per cui `setReady()` non faceva mai partire una partita reale (solo `createDebugGame` funzionava) è corretto. Restano fuori scope, rimandati a milestone successive: risoluzione della fase Preparazione (veleno/congelamento), incantesimi oltre ai 4 stub a danno, congelamento/avvelenamento/tuono/lava, esplosione elementale, acquisizione del Residuo Arcano, mana speciale, bonus manico, punta della bacchetta a runtime, hardening delle regole Firestore (oggi qualsiasi utente autenticato può scrivere lo stato di qualsiasi partita — accettato per questa milestone, nessuna transazione Firestore: solo il giocatore di turno scrive stato condiviso).

### 1. Fondamenta (bloccano tutto il resto)

- [x] Motore di turno reale con le 6 fasi del regolamento v2 (attesa, preparazione, raccolta, azione, incantesimo, fine). `game.model.ts` non ha più il `TurnPhase` locale stantio — importa `ActiveTurnPhase` da `turn-phase.model.ts` (le 5 fasi davvero persistibili; 'attesa' resta solo un valore di visualizzazione per chi non è di turno, mai scritto su Firestore). `board.component.ts` legge tutto da un `state` reale via `computed()`; resta da fare solo la risoluzione degli *effetti* di ogni fase (veleno/congelamento in Preparazione, incantesimi in Incantesimo — vedi sez. 2/3), non l'avanzamento in sé.
- [x] Sistema mana: rimossi `WAND_PIECE_MANA`/`BASE_TOTAL_MANA` da `wand.model.ts` e `mana`/`maxMana` da `PlayerState`; aggiunta `computePlayerMana(hand)` in `player.model.ts` (somma `ELEMENT_MANA` per carta) — non ancora chiamata da nessuna parte, dato che selezione/lancio incantesimi restano da fare. Nessun contatore "Mana: X" ambientale nell'HUD, come deciso.
- [x] Punti Salute: allineato a 20 (`PlayerState.hp`, regolamento v2 1.3). Rimosso `curseSlots` (non era una meccanica del regolamento v2) e il relativo effetto incantesimo `damage_cursed` da `SpellEffectType` — nessun incantesimo del catalogo lo usava.

### 2. Fasi del turno

- [x] Fase Raccolta (4.3): implementata in due passi persistiti su Firestore (`startCollect` pesca 2 e le mette in sospeso su `PlayerState.pendingCollect`, rimescolando gli scarti comuni se il mazzo è esaurito; `keepCard` risolve la scelta) — non un solo passo locale, perché un peek locale non scritto su Firestore si disallineerebbe dal mazzo vero se nel frattempo scattava un rimescolamento. La carta tenuta va negli scarti del proprio mazzo, non in mano.
- [x] Fase Finale (4.6): scarto totale della mano + pesca fresca di 5 carte, con rimescolamento automatico del proprio mazzo se necessario (`endTurn` in `turn-engine.ts`).
- [ ] Fase Preparazione (4.2): danni da veleno + scioglimento carte Congelamento, prima dell'inizio del turno — oggi è un passthrough (solo avanzamento di fase, nessun effetto risolto).
- [x] Rimescolamento mazzi (1.7): implementato in modo uniforme per tutti e tre i mazzi che si esauriscono in questa milestone — comune (Raccolta), avanzato (combinazione), proprio (fine turno) — via `drawUpTo()` in `deck-builder.ts`. Il decremento del livello di avvelenamento alla rimescolata del proprio mazzo resta da fare (dipende dall'avvelenamento, sez. 3).
- [ ] Bonus manico (1.4.3): 10%/20% di possibilità di +1 mana, applicato singolarmente a ciascuna delle 2 carte pescate in Raccolta (non solo a quella tenuta).

### 3. Meccaniche degli elementi

- [x] Fonte Arcana (2.6): `combineElements` in `turn-engine.ts` sostituisce il vecchio mock — le 2 basi vanno consumate negli scarti del mazzo comune (non semplicemente rimosse dalla mano, bug del mock originale), la carta ottenuta negli scarti del giocatore, lo slot si rimpiazza dal mazzo avanzato rimescolando i suoi scarti se esaurito (slot lasciato vuoto solo nel caso limite in cui anche gli scarti sono esauriti).
- [ ] Congelamento (2.3.1), Avvelenamento con decadimento (2.3.4), Tuono che torna in fondo al mazzo invece che negli scarti (2.3.2), Lava che consuma carte/dà scudi (2.3.3) — nessuna di queste è implementata oltre ai soli contatori (`PlayerTokens.poison/ice`, cap 0–3, senza il comportamento associato).
- [ ] Esplosione elementale (2.4): 1 danno quando due elementi potenti diversi sono nello stesso luogo (mano o Fonte Arcana) — nessuna traccia nel codice.
- [ ] Residuo Arcano (2.5): l'azione per ottenerlo (combinare due elementi base opposti) non è implementata — l'hover-highlight su Residuo in `board.component.ts` esiste già ma non è agganciato a nessuna azione.
- [ ] Mana speciale (3.2.x): prismatico, vitale, caotico — non presenti nei modelli attuali. `deck-builder.ts` genera il mazzo comune (60 carte, split 15/15/15/15 per elemento) e il mazzo avanzato (18 avanzati split 4/5/4/5 + 4 potenti) con placeholder espliciti, dato che `rules.md` non specifica la ripartizione esatta — da rivedere insieme a questo punto.

### 4. Testi del regolamento in-app

- [x] Riscritti `public/config/rulebook/it/*.md` (introduction, turn, source, mana, elements, wand) sul contenuto di `documentation/rulebook/v2/rules.md`. Aggiunto un settimo file, `spells.md` (Incantesimi + Regola d'oro), assente prima — nessuno dei 6 file copriva la sezione 5 del regolamento (creare/lanciare incantesimi) né la Regola d'oro. `public/config/regolamento.json` aggiornato con la nuova voce e un ordine di navigazione più didattico (Introduzione → Turno → Elementi → Fonte Arcana → Mana → Bacchetta → Incantesimi).

### Note aperte (bassa priorità, da tenere a mente)

- [ ] Valutare in futuro l'opzione "scarta invece di subire danno" sull'esplosione elementale, se il playtest mostra che il danno automatico pesa troppo (discusso, non deciso di aggiungere ora).
- [ ] `board.component.ts` ha un `effect()` che fa avanzare automaticamente l'avversario di debug (`guestId === 'debug-guest'`) attraverso tutte le fasi finché il turno non torna al giocatore reale — necessario per testare in solitaria finché non esiste un modo vero di giocare con due client. Da rimuovere o sostituire quando sarà possibile testare con un vero secondo giocatore (o con un'IA vera).

## TODO — Design carta (Design B)

- [x] Ridisegnare `card.component`: due sezioni tonde piene (non più solo icona centrata) integrate nel bordo, in alto a sinistra il valore di Mana e in basso a destra l'icona dell'elemento (l'icona resta un aiuto per l'accessibilità, non l'informazione primaria). Bordo e sezioni a opacità piena per restare leggibili sopra qualsiasi illustrazione. Aggiungere un `box-shadow` inset (accanto a quello esterno già usato per l'impilamento tra carte sovrapposte) che proietti una leggera ombra del bordo sull'illustrazione sottostante, per un effetto "scatola". Il badge Mana in alto a sinistra è la scelta deliberata: nel fan della mano le carte si overlappano al 58–80% (`board.component.ts`) con z-index crescente da sinistra a destra, quindi solo la striscia sinistra di ogni carta resta visibile — un badge in quell'angolo resta leggibile anche a mano piena, cosa che un'icona centrata non garantirebbe.