# Duels

## TODO

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
- [ ] Includere e implementare nel progetto il drag n drop del cdk per gestire le azioni.

### 4. i18n & opzioni

- [ ] Implementare i18n per avere multilingua (italiano + inglese) con italiano come lingua principale — prioritario da fare prima che il testo in giro nell'app cresca ancora (retrofit più costoso più si aspetta).
- [ ] Home / opzioni: aggiungere nelle opzioni una select per la lingua e un toggle per l'audio (la select lingua dipende da i18n sopra; il toggle audio presuppone un sistema audio non ancora esistente).

### 5. Profilo utente

- [ ] Home / utente: aggiungere il pallino con immagine dell'utente loggato e menu contestuale con dialog.
- [ ] Home / utente (dialog): opzioni disponibili: cambia nome visualizzato, url immagine personalizzata, scegli dorso (tra quelli disponibili / sbloccati), elimina account (dipende dal punto sopra; "elimina account" è distruttivo, va implementato con conferma esplicita).

### 6. Altro

- [ ] Correggere: NG02955: The NgOptimizedImage directive (activated on an <img> element with the `ngSrc="http://localhost:4200/cards/fire.png"`) has detected that this image is the Largest Contentful Paint (LCP) element but was not marked "priority". This image should be marked "priority" in order to prioritize its loading. To fix this, add the "priority" attribute.