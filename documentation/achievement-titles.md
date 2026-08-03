# Titoli obiettivi (Achievements) — revisione

Estrazione di tutti gli obiettivi attualmente in `src/app/data/objectives.ts`
(`OBJECTIVE_CATALOG`), raggruppati per categoria nello stesso ordine della
pagina Obiettivi in-app (`OBJECTIVE_CATEGORY_CATALOG`).

Nota: la pagina Obiettivi oggi non mostra un vero e proprio "nome" per il
trofeo, solo metrica e soglia (es. "Vittorie · 10") — la colonna **Id
obiettivo** qui sotto è quindi l'unico identificativo attuale di ciascun
trofeo, non un testo pensato per il giocatore. La colonna **Ricompensa
attuale** è solo di contesto (cosa sblocca, per aiutare a scegliere un titolo
coerente), non è il nome del trofeo — se un obiettivo dà già un Titolo con un
nome reale (es. "Novizio"), non è detto che il nome del trofeo debba
coincidere. `(TODO)` = ricompensa ancora un placeholder, nessun nome reale.

**Suggerimento** = una mia proposta, con tra parentesi il film/libro/
videogioco a cui si rifà — mai una citazione letterale, solo un'eco (come
avete già fatto voi con "Primo/Secondo/Terzo anno" per gli incantesimi, nod
perfetto ad Harry Potter). Dove il vostro "Titolo proposto" mi convince già,
lo dico e basta invece di inventarne uno a forza.

## Attività

| Id obiettivo     | Metrica · Soglia                                       | Ricompensa attuale                  | Titolo proposto          | Suggerimento                                        |
| ---------------- | ------------------------------------------------------ | ----------------------------------- | ------------------------ | --------------------------------------------------- |
| `rulebook_read`  | Leggi tutto il regolamento, ti servirà!                | Titolo "Istruito/Istruita/Istruit*" | Le regole del gioco      | **La regola del gioco** (_La règle du jeu_, Renoir) |
| `login_streak_7` | Effettua, per 7 giorni consecutivi, l'accesso al gioco | Titolo "Onnipresente"               | Parte della quotidianità | **Ricomincio da capo** (_Groundhog Day_)            |
| `friends_1`      | Aggiungi un amico                                      | Titolo "Duellante socievole"        | Amici miei               | **Amici miei** (commedia italiana sull'amicizia)    |
| `friends_5`      | Aggiungi 5 amici, più siamo meglio è!                  | Titolo "Duellante amichevole"       | Sei gradi di separazione | **Sei gradi di separazione** (rete di conoscenze)   |

## Esito duello

| Id obiettivo         | Metrica · Soglia                      | Ricompensa attuale                                                            | Titolo proposto                | Suggerimento                                                                                                                                            |
| -------------------- | ------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `first_duel`         | Gioca 1 duello                        | Titolo "Novizio/Novizia/Novizi*"                                              | L'inizio                       | **Episodio I** (_Star Wars_ — è il tuo primo duello)                                                                                                    |
| `first_win`          | Vinci 1 duello                        | Titolo "Apprendista"                                                          | Prima vittoria                 | già efficace così, semplice e diretto                                                                                                                   |
| `win_10`             | Colleziona 10 vittorie                | Dorso "Chiaro" (spostato qui, v. nota sotto)                                  | Puntare in alto                | ⚠️ il pun **Il biglietto d'oro** era legato al dorso Dorato — non più valido ora che qui c'è "Chiaro", da ripensare (es. qualcosa su "prima luce"/alba) |
| `win_50`             | Colleziona 50 vittorie                | Sfondo "Tessuto dorato"                                                       | Un grande risultato            | **50 sfumature di vittoria** (pun su _Cinquanta sfumature di grigio_)                                                                                   |
| `played_50`          | Gioca 50 duelli                       | Sfondo "Feltro consumato"                                                     | Ormai ci ho preso la mano      | **Cinquant'anni di solitudine** (pun su _Cent'anni di solitudine_, García Márquez)                                                                      |
| `lose_10`            | Perdi 10 duelli ma non arrenderti mai | Titolo "Ostinato/Ostinata/Ostinat*"                                           | Una serie di sfortunati eventi | **Una serie di sfortunati eventi** (Lemony Snicket)                                                                                                     |
| `win_streak_5`       | Vinci 5 partite consecutive           | Titolo "Inarrestabile" + Dorso "Dorato" (spostato da `win_10`, v. nota sotto) | Serie perfetta                 | ok così; se vuoi un'alternativa: **Su di giri**                                                                                                         |
| `friend_duel_1`      | Duella con un amico                   | Titolo "Socio/Socia/Soci*"                                                    | I duellanti                    | **I duellanti** (_The Duellists_, Ridley Scott — due amici che si sfidano più volte)                                                                    |
| `friend_duel_wins_5` | Sconfiggi 5 volte un amico            | Titolo "Rivale"                                                               | Ora siamo rivali               | **Cobra Kai** (la saga di _Karate Kid_ sulla rivalità)                                                                                                  |

**Nota — riassegnazione dorsi (✅ decisa E implementata, v. README):** Dorato è passato da `win_10`
a `win_streak_5` (si affianca a "Inarrestabile", non lo sostituisce — prima riga del catalogo dove
dorso e titolo coesistono sullo stesso obiettivo). `win_10` ha ereditato il dorso Chiaro, che ha
smesso di essere gratuito (`freeCardBacks()` in `firestore.rules` ora `['dark']`).

Rottura consapevole del principio "il gratuito resta gratuito per sempre" (ancora valido per
`freeBackgrounds()`) — accettata così com'era: nessuna migrazione retroattiva su
`unlockedCardBacks` per chi aveva già `light` equipaggiato da gratuito. Non gli viene tolto nulla
adesso (`cardBackValid()` valida solo quando il campo CAMBIA), ma se in futuro lo cambia dovrà
riguadagnarlo vincendo 10 duelli.

## Azioni comuni

| Id obiettivo  | Metrica · Soglia                                       | Ricompensa attuale                               | Titolo proposto           | Suggerimento                                                                   |
| ------------- | ------------------------------------------------------ | ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------ |
| `collect_100` | Raccogli un totale di almeno 100 carte                 | Titolo "Raccoglitore/Raccoglitrice/Raccoglitor*" | Nel dubbio prendili       | **Acchiappali tutti** (slogan Pokémon, calza a pennello per un gioco di carte) |
| `collect_500` | Raccogli un totale di almeno 500 carte                 | Sfondo (TODO) + Titolo "Collezionista"           | A qualcosa mi serviranno  | **La caccia al tesoro** — o **Un tesoro senza fine**                           |
| `combine_10`  | Combina 10 volte due o più carte per un Elemento nuovo | Titolo "Mixologista"                             | Come mattoncini           | ok così, il nod ai LEGO funziona già                                           |
| `combine_50`  | Combina 50 volte due o più carte per un Elemento nuovo | Sfondo (TODO) + Titolo "Alchimista"              | Combinazioni perfezionate | **Scambio alla pari** ("l'equivalent exchange" di _Fullmetal Alchemist_)       |

## Elementi

| Id obiettivo       | Metrica · Soglia                  | Ricompensa attuale                  | Titolo proposto               | Suggerimento                                                                                                              |
| ------------------ | --------------------------------- | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `combine_dark_5`   | Ottieni 5 carte Oscurità          | Titolo "Oscuro/Oscura/Oscur*"       | In solitudine nell'oscurità   | è la traduzione letterale di _Alone in the Dark_ — per restare meno 1:1: **Il lato oscuro** (_Star Wars_)                 |
| `combine_light_5`  | Ottieni 5 carte Luce              | Titolo "Luminoso/Luminosa/Luminos*" | Che la luce sia con te        | **Che la luce sia con te** (pun su "Che la Forza sia con te" — fa coppia col "lato oscuro" sopra)                         |
| `variant_fire`     | Ottieni o raccogli 50 carta Fuoco | Variante elemento "Fuoco"           | Il regno del fuoco            | già un nod a _Reign of Fire_; alternativa più letteraria: **Fahrenheit 451** (Bradbury)                                   |
| `variant_water`    | Ottieni o raccogli 50 carte Acqua | Variante elemento "Acqua"           | Un mondo d'acqua              | nod a _Waterworld_; alternativa: **Ventimila leghe sotto i mari** (Verne)                                                 |
| `variant_air`      | Ottieni o raccogli 50 carte Aria  | Variante elemento "Aria"            | L'ultimo duellante dell'aria  | **Via col vento** (pun sul titolo omonimo); o, più letterale sugli elementi: **L'ultimo dominatore dell'aria** (_Avatar_) |
| `variant_earth`    | Ottieni o raccogli 50 carte Terra | Variante elemento "Terra"           | I pilastri della terra        | ottimo (Ken Follett), tieni pure                                                                                          |
| `variant_thunder`  | Ottieni 25 carte Tuono            | Variante elemento "Tuono"           | Oltre la sfera del tuono      | alternativa più pop: **Il martello di Thor** (Marvel)                                                                     |
| `variant_poison`   | Ottieni 25 carte Veleno           | Variante elemento "Veleno"          | Rischio biologico             | già un bel nod a _Biohazard_ (titolo giapponese originale di _Resident Evil_), tieni pure                                 |
| `variant_ice`      | Ottieni 25 carte Ghiaccio         | Variante elemento "Ghiaccio"        | Il regno di ghiaccio          | **Il regno di ghiaccio** (pun su _Frozen_)                                                                                |
| `variant_lava`     | Ottieni 25 carte Lava             | Variante elemento "Lava"            | Viaggio al centro della Terra | **Viaggio al centro della Terra** (Verne — si arriva nel magma)                                                           |
| `variant_light`    | Ottieni 15 carte Luce             | Variante elemento "Luce"            | E la luce fu                  | alternativa: **E la luce fu** (Genesi, "Fiat lux")                                                                        |
| `variant_dark`     | Ottieni 15 carte Oscurità         | Variante elemento "Oscurità"        | Cuore di tenebra              | per non ripetere il "lato oscuro" sopra: **Cuore di tenebra** (Conrad)                                                    |
| `variant_residium` | Ottieni 25 carte Residuo Arcano   | Variante elemento "Residuo"         | Quel che resta                | è quasi già una citazione: **Quel che resta del giorno** (Ishiguro)                                                       |

## Incantesimi

| Id obiettivo      | Metrica · Soglia                                | Ricompensa attuale                                | Titolo proposto      | Suggerimento                                                                                   |
| ----------------- | ----------------------------------------------- | ------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `cast_15`         | Lancia 15 incantesimi                           | Titolo "Incantatore/Incantatrice/Incantator*"     | Primo anno           | ottimo, il filo Harry Potter regge benissimo                                                   |
| `cast_50`         | Lancia 50 incantesimi                           | Titolo "Magico/Magica/Magic*"                     | Secondo anno         | idem                                                                                           |
| `cast_100`        | Lancia 100 incantesimi                          | Sfondo "Arcano" + Titolo "Stregone/Strega/Streg*" | Terzo anno           | idem                                                                                           |
| `mana_100`        | Consuma almeno 100 Mana                         | Titolo "Spendaccione/Spendacciona/Spendaccion*"   | Impossibile smettere | **Confessioni di uno shopaholic** (Sophie Kinsella)                                            |
| `mana_200`        | Consuma almeno 200 Mana                         | Variante elemento "Mana"                          | Senza freni          | **Senza freni** — o, in tema con quello sopra: **Il conto è salato**                           |
| `cast_all_spells` | Lancia, almeno una volta, tutti gli Incantesimi | Dorso "Arcimago"                                  | Esame finale         | per chiudere il filo "Primo/Secondo/Terzo anno": **Il diploma** (fine del percorso a Hogwarts) |

## Combattimento

| Id obiettivo       | Metrica · Soglia                       | Ricompensa attuale                            | Titolo proposto      | Suggerimento                                                                                                                        |
| ------------------ | -------------------------------------- | --------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `damage_50`        | Infliggi almeno 50 danni in totale     | Titolo "Ostile"                               | Primo sangue         | **Prima sangue** (_First Blood_, Rambo)                                                                                             |
| `damage_100`       | Infliggi almeno 100 danni in totale    | Titolo "Pericoloso/Pericolosa/Pericolos*"     | Senza pietà          | **Kill Bill** (Tarantino) — o, più soft: **Senza pietà**                                                                            |
| `damage_500`       | Infliggi almeno 500 danni in totale    | Titolo "della Magia Nera"                     | Magia nera           | alternativa che lega al filo Harry Potter di "Incantesimi": **Le arti oscure**                                                      |
| `heal_50`          | Cura almeno 50 punti ferita in totale  | Titolo "Attento/Attenta/Attent*"              | Fattore rigenerante  | **Fattore rigenerante** (il potere di Wolverine)                                                                                    |
| `heal_100`         | Cura almeno 100 punti ferita in totale | Titolo "Resistente"                           | Fatto d'acciaio      | **Fatto d'acciaio** (_Man of Steel_/Superman)                                                                                       |
| `heal_500`         | Cura almeno 500 punti ferita in totale | Titolo "della Magia Bianca"                   | Magia bianca         | alternativa in tema Harry Potter: **Lacrime di fenice**                                                                             |
| `shield_gain_10`   | Attiva 10 Scudi                        | Titolo "In difesa"                            | Costruire un rifugio | alternativa: **Fatto di vibranio** (lo scudo di Captain America)                                                                    |
| `shield_gain_50`   | Attiva 50 Scudi                        | Titolo "In guardia"                           | In mezzo a loro      | alternativa: **Alle Termopili** (_300_, i trecento Spartani a scudi spiegati)                                                       |
| `shield_gain_100`  | Attiva 100 Scudi                       | Titolo "La muraglia"                          | La Barriera          | la ricompensa è già "La Muraglia": puoi citarla anche nel trofeo con **La Barriera** (_Game of Thrones_) o **Il Muro** (Pink Floyd) |
| `shield_remove_10` | Rimuovi 10 Scudi all'avversario        | Titolo "Spezzadifese"                         | Ariete               | ottimo, tieni pure                                                                                                                  |
| `shield_remove_50` | Rimuovi 50 Scudi all'avversario        | Titolo "Distruttore/Distruttrice/Distruttor*" | Abbattere i muri     | già un'eco del discorso di Reagan ("Abbatti questo muro!") — se vuoi renderlo più esplicito: **Giù quel muro**                      |

## Bacchetta

✅ **Categoria completa, tutte e 10 le righe implementate** (v. README) — `wandTipHeld`/
`wandSocketed` erano già eventi loggati ma nessun achievement li leggeva prima d'ora (tre contatori
lifetime `tipHeld`/`bodySocketed`/`handleSocketed`); la Resistenza/Vulnerabilità dell'asta invece
scattava senza lasciare traccia nel log, ora c'è un nuovo evento dedicato
(`wandResistanceTriggered`, `game-log.model.ts`) che alimenta `UserStats.wandDamageResisted`/
`selfDamageResisted`/`selfVulnerableWins`. Il dorso "wands" (asset `public/cards-back/wands.webp`)
è finito su `wand_self_vulnerable` come deciso, non su `wand_actions_300`: quest'ultimo dà solo un
Titolo — l'unico dorso del catalogo a premiare un azzardo deliberato invece di grind/completismo.

| Id obiettivo                         | Metrica · Soglia                                                                                                                                              | Ricompensa attuale                                                       | Titolo proposto                       | Suggerimento                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `wand_tip_10` ✅                     | Trattieni un elemento alla punta della bacchetta 15 volte                                                                                                     | Titolo "Previdente"                                                      | Lo tengo per dopo                     | **Doctor Strange** (guarda avanti nel tempo prima di agire)                                                                      |
| `wand_tip_50` ✅                     | Trattieni un elemento alla punta della bacchetta 50 volte                                                                                                     | Titolo "Lungimirante"                                                    | Sempre un passo avanti                | **Minority Report** (agire prima che serva)                                                                                      |
| `wand_body_10` ✅                    | Incastona un elemento nell'asta della bacchetta 15 volte                                                                                                      | Titolo "Temprato/Temprata/Tempr*"                                        | Dare e avere                          | **Excalibur** (l'arma forgiata che protegge chi la porta)                                                                        |
| `wand_body_50` ✅                    | Incastona un elemento nell'asta della bacchetta 50 volte                                                                                                      | Titolo "Inespugnabile"                                                   | Accettare il rischio                  | **Alle Termopili** (_300_ — resta in tema con `shield_gain_50` sopra)                                                            |
| `wand_handle_10` ✅                  | Incastona un elemento nel manico della bacchetta 15 volte                                                                                                     | Titolo "Incantato/Incantata/Incantat*"                                   | Preferisco questo                     | **Harry Potter** ("è la bacchetta che sceglie il mago" — richiama il filo Hogwarts già usato per `cast_15`/`cast_50`/`cast_100`) |
| `wand_handle_50` ✅                  | Incastona un elemento nel manico della bacchetta 50 volte                                                                                                     | Titolo "Magnetico/Magnetica/Magnetic*"                                   | Puntare tutto                         | **Il flauto magico** (Mozart — uno strumento che ammalia)                                                                        |
| `wand_actions_300` ✅                | Trattieni/incastona, in qualunque combinazione (punta+asta+manico), un totale di 300 volte                                                                    | Titolo "Maestro di bacchetta/Maestra di bacchetta/Maestr\* di bacchetta" | Usa bene i tuoi strumenti             | **Storia infinita** (Bastian e il libro — un legame speciale con lo strumento)                                                   |
| `black_flame_win` ✅                 | Vinci un duello dopo aver lanciato la Fiamma Nera                                                                                                             | Titolo "Diabolico/Diabolica/Diabolic*" (**già fissato** in `titles.md`)  | Gioco col fuoco                       | —                                                                                                                                |
| `wand_self_resist` ✅                | Usa la Fiamma Nera con Fuoco incastonato nell'asta, riducendone il danno su te stesso                                                                         | Titolo "Infernale" (**già fissato** in `titles.md`)                      | Io sono fuoco                         | **Harry Potter e la Camera dei Segreti** (Fanny, la fenice immune al fuoco)                                                      |
| `wand_resist_10`/`wand_resist_50` ✅ | La tua bacchetta riduce un danno che stai per subire (qualunque fonte, non solo Fiamma Nera) — 10/50 volte, due obiettivi separati come il resto del catalogo | Titolo "Corazzato/Corazzata/Corazzat*" (10) + "Indistruttibile" (50)     | Ridurre il rischio / A prova di tutto | **Iron Man** (l'armatura che assorbe i colpi)                                                                                    |
| `wand_self_vulnerable` ✅            | Vinci un duello dopo aver usato la Fiamma Nera con Acqua incastonata nell'asta (vulnerabile al fuoco, danno maggiorato)                                       | Titolo "Temerario/Temeraria/Temerari*" + Dorso "wands"                   | Non temo nulla                        | **300** ("Questa è Sparta!" — sapere di poter perdere e caricare comunque)                                                       |

Note per la revisione:

- `wand_resist_10`/`wand_resist_50` sono un conteggio ripetuto (come la maggior parte del catalogo);
  `wand_self_resist`/`wand_self_vulnerable` restano invece "una tantum" (soglia 1), coerenti con
  Infernale così come già fissato in `titles.md`.
- Asimmetria voluta tra resistenza e vulnerabilità: Infernale (resistenza) NON richiede la vittoria
  — è una scelta sicura, basta averla sfruttata bene. `wand_self_vulnerable` (vulnerabilità) SÌ — è
  un vero azzardo, "Non temo nulla" ha senso solo se il rischio ha ripagato, non se hai perso
  comunque dopo esserti autoinflitto più danno. Infernale resta invariato rispetto a `titles.md`
  apposta (nessuna modifica alla definizione già fissata).
- Ogni volta che scatta Infernale, conta ANCHE per `wand_resist_10`/`wand_resist_50` (stesso evento,
  letto due volte con condizioni diverse) — nessuna esclusione reciproca, stesso principio già in
  uso tra `cast_15`/`cast_50`/`cast_100`.
- `wand_body_50`/`wand_handle_50` sono ancora senza un nome che non riecheggi righe già usate sopra
  in questo file (scudi/Hogwarts) — primi candidati a essere rivisti.
- Dorso "wands" spostato da `wand_actions_300` a `wand_self_vulnerable`: deve premiare un obiettivo
  perseguito DELIBERATAMENTE (l'azzardo di "Non temo nulla"), non un traguardo raggiunto quasi per
  caso giocando tanto nel tempo. `wand_actions_300` resta comunque nel catalogo come riconoscimento
  del "lungo corso", ma solo con un Titolo — nome "Maestro di bacchetta" ancora provvisorio, il più
  debole della sezione, primo candidato a essere rivisto insieme a `wand_body_50`/`wand_handle_50`.
