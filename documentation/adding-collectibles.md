# Aggiungere un nuovo collezionabile

Guida pratica passo-passo per aggiungere dorsi, sfondi, titoli, emote (e i loro sblocchi) senza
dover rileggere tutto il codice ogni volta. Scritta per essere seguibile anche da chi non
programma abitualmente: ogni ricetta ha un esempio concreto, copiabile così com'è (poi cambi solo
nomi/id). Se qualcosa qui non combacia più col codice, il codice ha ragione — aggiorna questo file
di conseguenza.

## Prima di iniziare — 5 minuti se non hai mai toccato questi file

- **Array**: una lista tra parentesi quadre `[ ... ]`, con gli elementi separati da virgola. Nei
  cataloghi qui sotto è quasi sempre una lista di "oggetti" (v. sotto), uno per riga.
- **Oggetto**: un blocco tra parentesi graffe `{ ... }` con coppie `chiave: valore` separate da
  virgola, es. `{ id: 'dark', unlock: { kind: 'free' } }` — qui `id` e `unlock` sono le chiavi.
- **Stringa**: testo tra apici, es. `'dark'` (nei file `.ts`) o `"dark"` (nei file `.json` — i
  `.json` vogliono SEMPRE le doppie, i `.ts` di questo progetto usano le singole).
- **Come trovare il punto giusto**: apri il file nel tuo editor, premi `Ctrl+F` (`Cmd+F` su Mac) e
  cerca il nome scritto qui tra backtick in MAIUSCOLO (es. `CARD_BACK_CATALOG`) — ti porta dritto
  alla riga giusta.
- **Virgole**: ogni riga dentro un array/oggetto, TRANNE L'ULTIMA, deve finire con una virgola.
  Errore più comune: dimenticarla sulla riga sopra quella appena aggiunta.
- **Dopo ogni modifica**: salva il file, poi apri un terminale nella cartella del progetto e lancia
  `npx tsc --noEmit` — se non stampa nulla (o solo `npm notice`), va tutto bene. Se stampa un
  errore con un percorso file e un numero di riga, è lì che c'è un typo (di solito una virgola o un
  apice mancante).

## Concetti comuni

Ogni tipo di collezionabile (dorsi, sfondi, titoli, emote) ha lo stesso schema a 3 pezzi:

1. **Catalogo** in `src/app/data/*.ts` — un array di `{ id, unlock, ...metadata }`. **Mai il testo
   qui dentro**, solo id e regola di sblocco (`RewardUnlock`, `src/app/models/reward-unlock.model.ts`).
2. **Traduzioni** in `public/i18n/it.json` **e** `public/i18n/en.json` — nome/descrizione/frase
   risolti dall'id del catalogo.
3. **[CollectionComponent](../src/app/pages/collection/collection.component.ts)** legge il catalogo
   e disegna la griglia da solo — se aggiungi una entry a un catalogo già esistente, **non devi
   toccare la UI**, compare in automatico.

`RewardUnlock.kind`:

| kind           | Cosa significa                   | Cosa devi fare in più                                                     |
| -------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `free`         | Sempre posseduto                 | Aggiungilo anche al mirror in `firestore.rules` (v. sotto)                |
| `objective`    | Sblocca completando un obiettivo | L'obiettivo deve esistere in `OBJECTIVE_CATALOG` (Ricetta 6)              |
| `redeemCode`   | Sblocca con un codice riscatto   | Crea a mano il documento `codes/{CODICE}` (Ricetta 2)                     |
| `purchase`     | Acquisto sostenitori             | Nessun flusso di pagamento esiste ancora — mostrato come "in arrivo"      |
| `seasonal`     | Evento stagionale                | Meccanismo non ancora implementato — mostrato come "in arrivo"            |
| `inviteFriend` | Invitando un amico               | Meccanismo non ancora implementato — mostrato come "in arrivo"            |
| `exclusive`    | Riservato a UN uid specifico     | Solo per titoli oggi (v. `EXCLUSIVE_TITLE_OWNER_UID` in `data/titles.ts`) |

**Trappola nota**: `public/config/card-backs.json` e `public/config/titles.json` **non sono letti
da nessun codice** — sono relitti di una versione precedente dell'app, prima che esistessero i
cataloghi TypeScript sotto. Ignorali, non toccarli. L'unico file in `public/config/` ancora vivo
per i collezionabili è **`backgrounds.json`** (v. Ricetta 3) — `fetch`-ato a runtime da
`BackgroundService` per sapere quali sfondi esistono ed applicarli live, un ruolo diverso dal
catalogo `data/backgrounds.ts` (quello guida solo Collezione/sblocchi).

## Pipeline immagini (dorsi/sfondi, quando serve arte nuova)

1. Droppa il master ad alta risoluzione (`.png`/`.jpg`) in `assets-source/<sottocartella>/<id>.png`
   — questa cartella non viene mai deployata (`angular.json` include solo `public/**/*`), può
   restare a piena risoluzione.
2. Lancia `npm run images:optimize` (`scripts/optimize-images.mjs`) — mirror-a automaticamente la
   stessa sottocartella dentro `public/`, convertendo in WebP (480px per default, 1920px per gli
   sfondi app — v. `WIDTH_OVERRIDES` nello script).
3. Sottocartelle in uso oggi: `assets-source/cards-back/` → `public/cards-back/<id>.webp` (dorsi),
   `assets-source/images/backgrounds/` → `public/images/backgrounds/<id>.webp` (sfondi).

Nessun collezionabile testuale (titoli, emote) ha bisogno di questo passo — `imageUrl: null` per
loro, mostrati come testo/tessera senza arte.

---

Le ricette 1, 4 e 6 sotto condividono un unico esempio filo conduttore: un nuovo dorso **"Fenice"**
e un nuovo titolo **"Veterano"**, entrambi sbloccati da un nuovo obiettivo **"Vinci 25 duelli"**
(che creerai per ultimo, in Ricetta 6). Le ricette 2, 3 e 5 hanno ciascuna un esempio indipendente.

## Ricetta 1 — Nuovo dorso carta (`cardBacks`)

**Esempio: dorso "Fenice" (`phoenix`), sbloccato vincendo 25 duelli.**

1. Arte: metti il file in `assets-source/cards-back/phoenix.png`, poi lancia
   `npm run images:optimize` — otterrai `public/cards-back/phoenix.webp`.
2. Apri [src/app/data/card-backs.ts](../src/app/data/card-backs.ts), cerca `CARD_BACK_CATALOG` e
   aggiungi una riga PRIMA della `]` finale:

   ```ts
   export const CARD_BACK_CATALOG: CardBackDefinition[] = [
     { id: 'dark', unlock: { kind: 'free' } },
     // ...tutte le righe esistenti, non toccarle...
     { id: 'amber', unlock: { kind: 'objective', objectiveId: 'combine_150' } },
     // 👇 riga nuova
     { id: 'phoenix', unlock: { kind: 'objective', objectiveId: 'win_25' } },
   ];
   ```

   `objectiveId: 'win_25'` deve combaciare ESATTAMENTE con l'id dell'obiettivo che creerai in
   Ricetta 6 — se scrivi un id diverso lì, cambia anche qui.

3. Apri `public/i18n/it.json`, cerca `"cardBackCatalog"` e aggiungi (con la virgola giusta sulla
   riga sopra):

   ```json
   "phoenix": {
     "name": "Fenice",
     "description": "Rinasce dalle proprie ceneri — per chi non si arrende mai."
   }
   ```

   Ripeti la stessa cosa in `public/i18n/en.json` (stessa chiave `"phoenix"`, testo in inglese).

4. Non serve toccare `firestore.rules` in questo esempio — `unlock.kind` è `'objective'`, non
   `'free'` (il mirror in `firestore.rules` serve solo per i dorsi sempre gratuiti).

## Ricetta 2 — Dorso (e/o emote) via codice riscatto (`redeemCode`)

**Esempio: un unico codice `BETA2026` che assegna sia il dorso "de-bug" sia una frase emote
"Grazie di provarlo!" (`thanks_beta`) — il caso reale della sessione di test.**

Un codice può accreditare **più ricompense insieme, anche di tipo diverso** (dorso + emote): il
documento `codes/{CODICE}` ha due liste separate, `cardBackIds` e `emoteIds`, entrambe opzionali —
riempi solo quella/e che ti servono.

1. Il dorso da assegnare deve già avere `unlock: { kind: 'redeemCode' }` nel suo catalogo (per
   `de-bug` è già così in `CARD_BACK_CATALOG` — nessuna modifica lì). Se invece stai creando un
   dorso NUOVO da distribuire via codice, prima fai i passi 1-2 della Ricetta 1 con
   `unlock: { kind: 'redeemCode' }`.
2. Stesso discorso per un'emote: deve avere `unlock: { kind: 'redeemCode' }` in `EMOTE_CATALOG`
   (Ricetta 5) invece di `'free'`, e — visto che oggi le emote sono dietro
   `EMOTES_FEATURE_ENABLED` — ricorda che finché quel flag resta `false` nessuno le vede comunque
   in Collezione, anche se il codice funziona.
3. Traduzioni come al passo 3 della Ricetta 1 (dorsi) / passo 2 della Ricetta 5 (emote).
4. Crea **a mano** il codice — mai dal client, per sicurezza (`firestore.rules` blocca del tutto la
   scrittura su questa collection dall'app):
   - Vai su [console.firebase.google.com](https://console.firebase.google.com), progetto
     `duels-2026` → **Firestore Database**.
   - Apri (o crea, se non esiste ancora) la collection `codes`.
   - Aggiungi un nuovo documento con **ID documento = `BETA2026`** (il codice stesso, sempre
     MAIUSCOLO — è quello che l'utente digiterà in "Riscatta codice").
   - Aggiungi questi campi al documento (tipi esatti tra parentesi):
     | Campo         | Tipo               | Valore per questo esempio                                   |
     | ------------- | ------------------ | ----------------------------------------------------------- |
     | `cardBackIds` | array di string    | `["de-bug"]`                                                |
     | `emoteIds`    | array di string    | `["thanks_beta"]`                                           |
     | `startAt`     | null (o timestamp) | `null` — nessuna data di inizio                             |
     | `endAt`       | null (o timestamp) | `null` — non scade mai, o una data futura se vuoi che scada |

   Un codice che assegna SOLO un dorso omette semplicemente `emoteIds` (e viceversa) — non serve un
   array vuoto, basta non aggiungere quel campo.

5. Fine — `AuthService.redeemCode()` e la regola `redeemGrantValid()` in `firestore.rules` fanno il
   resto quando qualcuno lo riscatta in app: sblocca entrambi insieme in un solo riscatto.

**Nota di migrazione**: prima di questa estensione, `RedeemCode` aveva un solo campo `cardBackId`
(stringa singola, non array). Se esiste già un documento `codes/*` creato con lo schema vecchio
(es. `codes/b00ks2024` per il dorso "books", v. changelog) **non funziona più così com'è** — va
riaperto e il campo rinominato `cardBackId: "books"` → `cardBackIds: ["books"]` (array).

## Ricetta 3 — Nuovo sfondo (`backgrounds`)

**Esempio: sfondo "Tramonto" (`sunset`), gratuito fin da subito.**

A differenza dei dorsi, gli sfondi hanno **due** file da aggiornare (non uno):

1. Arte: `assets-source/images/backgrounds/sunset.png` → `npm run images:optimize` →
   `public/images/backgrounds/sunset.webp`.
2. Apri [src/app/data/backgrounds.ts](../src/app/data/backgrounds.ts), cerca `BACKGROUND_CATALOG`:

   ```ts
   export const BACKGROUND_CATALOG: BackgroundDefinition[] = [
     { id: 'dark-wood', unlock: { kind: 'free' } },
     // ...righe esistenti...
     { id: 'amber', unlock: { kind: 'objective', objectiveId: 'collect_500' } },
     // 👇 riga nuova
     { id: 'sunset', unlock: { kind: 'free' } },
   ];
   ```

3. Apri anche [public/config/backgrounds.json](../public/config/backgrounds.json) (questo È letto
   a runtime, v. nota sopra) e aggiungi una riga:

   ```json
   { "id": "sunset", "file": "/images/backgrounds/sunset.webp", "free": true }
   ```

   `"free": true` qui deve combaciare con `unlock: { kind: 'free' }` nel file `.ts` del passo 2.

4. Traduzioni in `it.json`/`en.json`, cerca `"backgroundCatalog"`:

   ```json
   "sunset": {
     "name": "Tramonto",
     "description": "I colori caldi del sole che cala su un circolo di maghi."
   }
   ```

5. Essendo `free: true`, apri [firestore.rules](../firestore.rules), cerca `freeBackgrounds()`
   (riga ~53) e aggiungi `'sunset'` alla lista:

   ```
   function freeBackgrounds() {
     return ['dark-wood', 'light-wood', 'burn-wood', 'slate', 'sunset'];
   }
   ```

   Poi deploya le regole con `npm run rules` (richiede di aver fatto login con
   `npx firebase-tools login` almeno una volta).

## Ricetta 4 — Nuovo titolo (`titles`)

**Esempio: titolo "Veterano" (`veteran`), maschile/femminile/neutro, sbloccato vincendo 25 duelli
(stesso obiettivo di "Fenice" sopra).**

I titoli in italiano spesso servono in 3 varianti di genere: maschile, femminile, neutro/inclusivo
(finale con l'asterisco, es. "Veteran\*").

1. Apri [src/app/data/titles.ts](../src/app/data/titles.ts), cerca `GENDERED_TITLE_IDS` e aggiungi
   `'veteran'` alla lista (con la virgola):

   ```ts
   export const GENDERED_TITLE_IDS: ReadonlySet<string> = new Set<string>([
     'novice',
     'stubborn',
     // ...righe esistenti...
     'daring',
     'veteran', // 👈 riga nuova
   ]);
   ```

   (Se il tuo titolo NON ha bisogno di forme diverse per maschile/femminile — es. è un aggettivo
   invariabile come "Resistente" — salta questo passo, resterà un id singolo.)

2. Cerca `TITLE_CATALOG` nello stesso file e aggiungi una riga prima della `]` finale:

   ```ts
   { id: 'veteran', unlock: { kind: 'objective', objectiveId: 'win_25' } },
   ```

3. Traduzioni: essendo un titolo "gendered", servono 3 chiavi in `it.json` (cerca
   `"titleCatalog"`) e le stesse 3 in `en.json`:

   ```json
   "veteran_m": { "name": "Veterano" },
   "veteran_f": { "name": "Veterana" },
   "veteran_x": { "name": "Veteran*" }
   ```

4. Non serve toccare `firestore.rules` — `unlock.kind` è `'objective'`, non `'free'`.

## Ricetta 5 — Nuova emote (`emotes`, dietro `EMOTES_FEATURE_ENABLED`)

**Esempio: emote "Ti va di riprovare?" (`taunt_retry`), categoria Provocazione.**

1. Apri [src/app/data/emotes.ts](../src/app/data/emotes.ts), cerca `EMOTE_CATALOG`:

   ```ts
   export const EMOTE_CATALOG: EmoteDefinition[] = [
     { id: 'greeting_default', category: 'greeting', unlock: { kind: 'free' } },
     // ...righe esistenti...
     { id: 'oops_default', category: 'oops', unlock: { kind: 'free' } },
     // 👇 riga nuova
     { id: 'taunt_retry', category: 'taunt', unlock: { kind: 'free' } },
   ];
   ```

   `category` deve essere una delle 6 già esistenti (`greeting`/`taunt`/`compliment`/`thanks`/
   `sorry`/`oops` — v. `EmoteCategory` in `src/app/models/emote.model.ts`): non è pensata per
   crescere in numero senza deciderlo apposta.

2. Traduzione, cerca `"emoteCatalog"` in `it.json`/`en.json`:

   ```json
   "taunt_retry": { "text": "Ti va di riprovare?" }
   ```

3. Se `unlock.kind` è `'free'` (come nell'esempio), aggiungi anche l'id a `freeEmotes()` in
   [firestore.rules](../firestore.rules) — mirror manuale, stesso schema di `freeCardBacks()`/
   `freeTitles()`: senza quella riga la nuova frase non sarebbe equipaggiabile (`equippedEmotesValid()`
   la rifiuterebbe). Se invece `unlock.kind` è `'redeemCode'` non serve toccare le regole: l'id
   diventa equipaggiabile non appena finisce in `unlockedEmotes` via riscatto codice (v. `redeemValid()`
   in `firestore.rules`, già copre `unlockedEmotes`).

   Vuoi aggiungere il testo di una frase PRIMA di aver deciso come si sblocca? Usa
   `unlock: { kind: 'objectivePending' }` (v. `reward-unlock.model.ts`) invece di `'free'`: compare
   comunque in Collezione (bloccata, con "Condizione di sblocco non ancora disponibile"), ma non è
   equipaggiabile da nessuno — niente da toccare in `firestore.rules`, non essendo mai né `free` né
   in `unlockedEmotes`. Quando deciderai l'obiettivo giusto, sostituisci con
   `{ kind: 'objective', objectiveId: '...' }` (v. Ricetta 6 sotto).

4. `EMOTES_FEATURE_ENABLED` (in cima a `data/emotes.ts`) è `true` dal lancio dello strumento emote
   in game — equip (Collezione, "Personalizza") e lancio (in game) sono entrambi implementati, non
   c'è più nulla da tenere nascosto qui.

## Ricetta 6 — Nuovo obiettivo (Achievements) che sblocca uno dei collezionabili sopra

**Esempio: obiettivo "Vinci 25 duelli" (`win_25`) — quello a cui rimandano "Fenice" (Ricetta 1) e
"Veterano" (Ricetta 4): un solo obiettivo, due ricompense insieme.**

**Caso semplice — la metrica esiste già** (quasi sempre: v. `ObjectiveMetric` in
`models/objective.model.ts`, es. `wins`, `combinationsMade`, `spellsCast`...):

1. Apri [src/app/data/objectives.ts](../src/app/data/objectives.ts), cerca `OBJECTIVE_CATALOG` e
   aggiungi una riga (qui un obiettivo può dare più ricompense insieme, come in questo esempio):

   ```ts
   export const OBJECTIVE_CATALOG: Objective[] = [
     {
       id: 'first_duel',
       metric: 'gamesPlayed',
       threshold: 1,
       rewards: [{ type: 'title', id: 'novice' }],
     },
     // ...righe esistenti...
     // 👇 riga nuova
     {
       id: 'win_25',
       metric: 'wins',
       threshold: 25,
       rewards: [
         { type: 'cardBack', id: 'phoenix' },
         { type: 'title', id: 'veteran' },
       ],
     },
   ];
   ```

   Nota: per i titoli con varianti di genere (come `veteran`) basta l'id BASE qui (`'veteran'`, non
   `'veteran_m'`) — il gioco assegna tutte e 3 le varianti da solo al momento del riscatto.

2. Traduzione, cerca `"names"` dentro `"objectives"` in `it.json`/`en.json`:

   ```json
   "win_25": "Un guerriero navigato"
   ```

3. La metrica `wins` è già assegnata alla categoria "Esito duello" in
   [data/objective-categories.ts](../src/app/data/objective-categories.ts) — se stai riusando una
   metrica esistente (quasi sempre il caso), NON serve toccare questo file.

**Caso avanzato — serve una metrica MAI tracciata prima** (nessun campo `UserStats` esistente la
copre): è un lavoro cross-sistema più grande (nuovo campo in `UserStats`/`EMPTY_USER_STATS`, logica
di derivazione in `AuthService.applyGameStats`/`game/achievements.ts`, nuova voce
`ObjectiveMetric`, `metricLabels` i18n, categoria in `objective-categories.ts`) — non è una ricetta
rapida, fermati e chiedi aiuto invece di procedere per tentativi.

## Checklist finale (prima di committare)

- [ ] Asset ottimizzato (`npm run images:optimize`), se serviva arte nuova.
- [ ] Riga nel catalogo `data/*.ts` giusto.
- [ ] Traduzioni in **entrambi** `it.json` e `en.json`.
- [ ] Se `free`: mirror aggiornato in `firestore.rules` (`freeCardBacks`/`freeBackgrounds`/`freeTitles`).
- [ ] Se `redeemCode`: documento `codes/{CODICE}` creato a mano (mai dal client).
- [ ] Se `objective`: l'obiettivo esiste in `OBJECTIVE_CATALOG` con quell'id esatto.
- [ ] `npx tsc --noEmit` pulito, `npx prettier --write .` lanciato.
- [ ] Se hai toccato `firestore.rules`: `npm run rules` per deployarle (richiede login Firebase CLI) — **non dimenticarlo**, un catalogo aggiornato senza le regole aggiornate lascia lo sblocco "free" bloccato lato server.

Se qualcosa non torna, o `npx tsc --noEmit` stampa un errore che non capisci: meglio fermarsi e
chiedere (a chi programma, o a Claude Code) che indovinare — specialmente su `firestore.rules`, che
protegge tutti i profili utente.
