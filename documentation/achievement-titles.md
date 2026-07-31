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

| Id obiettivo | Metrica · Soglia | Ricompensa attuale | Titolo proposto | Suggerimento |
| --- | --- | --- | --- | --- |
| `rulebook_read` | Leggi tutto il regolamento, ti servirà! | Titolo "Istruito/Istruita/Istruit*" | Le regole del gioco | **La regola del gioco** (*La règle du jeu*, Renoir) |
| `login_streak_7` | Effettua, per 7 giorni consecutivi, l'accesso al gioco | Titolo "Onnipresente" | Parte della quotidianità | **Ricomincio da capo** (*Groundhog Day*) |
| `friends_1` | Aggiungi un amico | Titolo "Duellante socievole" | Amici miei | **Amici miei** (commedia italiana sull'amicizia) |
| `friends_5` | Aggiungi 5 amici, più siamo meglio è! | Titolo "Duellante amichevole" | Sei gradi di separazione | **Sei gradi di separazione** (rete di conoscenze) |

## Esito duello

| Id obiettivo | Metrica · Soglia | Ricompensa attuale | Titolo proposto | Suggerimento |
| --- | --- | --- | --- | --- |
| `first_duel` | Gioca 1 duello | Titolo "Novizio/Novizia/Novizi*" | L'inizio | **Episodio I** (*Star Wars* — è il tuo primo duello) |
| `first_win` | Vinci 1 duello | Titolo "Apprendista" | Prima vittoria | già efficace così, semplice e diretto |
| `win_10` | Colleziona 10 vittorie | Dorso "Dorato" | Puntare in alto | **Il biglietto d'oro** (*Willy Wonka* — combacia col dorso Dorato) |
| `win_50` | Colleziona 50 vittorie | Sfondo "Tessuto dorato" | Un grande risultato | **50 sfumature di vittoria** (pun su *Cinquanta sfumature di grigio*) |
| `played_50` | Gioca 50 duelli | Sfondo "Feltro consumato" | Ormai ci ho preso la mano | **Cinquant'anni di solitudine** (pun su *Cent'anni di solitudine*, García Márquez) |
| `lose_10` | Perdi 10 duelli ma non arrenderti mai | Titolo "Ostinato/Ostinata/Ostinat*" | Una serie di sfortunati eventi | **Una serie di sfortunati eventi** (Lemony Snicket) |
| `win_streak_5` | Vinci 5 partite consecutive | Titolo "Inarrestabile" | Serie perfetta | ok così; se vuoi un'alternativa: **Su di giri** |
| `friend_duel_1` | Duella con un amico | Titolo "Socio/Socia/Soci*" | I duellanti | **I duellanti** (*The Duellists*, Ridley Scott — due amici che si sfidano più volte) |
| `friend_duel_wins_5` | Sconfiggi 5 volte un amico | Titolo "Rivale" | Ora siamo rivali | **Cobra Kai** (la saga di *Karate Kid* sulla rivalità) |

## Azioni comuni

| Id obiettivo | Metrica · Soglia | Ricompensa attuale | Titolo proposto | Suggerimento |
| --- | --- | --- | --- | --- |
| `collect_100` | Raccogli un totale di almeno 100 carte | Titolo "Raccoglitore/Raccoglitrice/Raccoglitor*" | Nel dubbio prendili | **Acchiappali tutti** (slogan Pokémon, calza a pennello per un gioco di carte) |
| `collect_500` | Raccogli un totale di almeno 500 carte | Sfondo (TODO) + Titolo "Collezionista" | A qualcosa mi serviranno | **La caccia al tesoro** — o **Un tesoro senza fine** |
| `combine_10` | Combina 10 volte due o più carte per un Elemento nuovo | Titolo "Mixologista" | Come mattoncini | ok così, il nod ai LEGO funziona già |
| `combine_50` | Combina 50 volte due o più carte per un Elemento nuovo | Sfondo (TODO) + Titolo "Alchimista" | Combinazioni perfezionate | **Scambio alla pari** ("l'equivalent exchange" di *Fullmetal Alchemist*) |

## Elementi

| Id obiettivo | Metrica · Soglia | Ricompensa attuale | Titolo proposto | Suggerimento |
| --- | --- | --- | --- | --- |
| `combine_dark_5` | Ottieni 5 carte Oscurità | Titolo "Oscuro/Oscura/Oscur*" | In solitudine nell'oscurità | è la traduzione letterale di *Alone in the Dark* — per restare meno 1:1: **Il lato oscuro** (*Star Wars*) |
| `combine_light_5` | Ottieni 5 carte Luce | Titolo "Luminoso/Luminosa/Luminos*" | Che la luce sia con te | **Che la luce sia con te** (pun su "Che la Forza sia con te" — fa coppia col "lato oscuro" sopra) |
| `variant_fire` | Ottieni o raccogli 50 carta Fuoco | Variante elemento "Fuoco" | Il regno del fuoco | già un nod a *Reign of Fire*; alternativa più letteraria: **Fahrenheit 451** (Bradbury) |
| `variant_water` | Ottieni o raccogli 50 carte Acqua | Variante elemento "Acqua" | Un mondo d'acqua | nod a *Waterworld*; alternativa: **Ventimila leghe sotto i mari** (Verne) |
| `variant_air` | Ottieni o raccogli 50 carte Aria | Variante elemento "Aria" | L'ultimo duellante dell'aria | **Via col vento** (pun sul titolo omonimo); o, più letterale sugli elementi: **L'ultimo dominatore dell'aria** (*Avatar*) |
| `variant_earth` | Ottieni o raccogli 50 carte Terra | Variante elemento "Terra" | I pilastri della terra | ottimo (Ken Follett), tieni pure |
| `variant_thunder` | Ottieni 25 carte Tuono | Variante elemento "Tuono" | Oltre la sfera del tuono | alternativa più pop: **Il martello di Thor** (Marvel) |
| `variant_poison` | Ottieni 25 carte Veleno | Variante elemento "Veleno" | Rischio biologico | già un bel nod a *Biohazard* (titolo giapponese originale di *Resident Evil*), tieni pure |
| `variant_ice` | Ottieni 25 carte Ghiaccio | Variante elemento "Ghiaccio" | Il regno di ghiaccio | **Il regno di ghiaccio** (pun su *Frozen*) |
| `variant_lava` | Ottieni 25 carte Lava | Variante elemento "Lava" | Viaggio al centro della Terra | **Viaggio al centro della Terra** (Verne — si arriva nel magma) |
| `variant_light` | Ottieni 15 carte Luce | Variante elemento "Luce" | E la luce fu | alternativa: **E la luce fu** (Genesi, "Fiat lux") |
| `variant_dark` | Ottieni 15 carte Oscurità | Variante elemento "Oscurità" | Cuore di tenebra | per non ripetere il "lato oscuro" sopra: **Cuore di tenebra** (Conrad) |
| `variant_residium` | Ottieni 25 carte Residuo Arcano | Variante elemento "Residuo" | Quel che resta | è quasi già una citazione: **Quel che resta del giorno** (Ishiguro) |

## Incantesimi

| Id obiettivo | Metrica · Soglia | Ricompensa attuale | Titolo proposto | Suggerimento |
| --- | --- | --- | --- | --- |
| `cast_15` | Lancia 15 incantesimi | Titolo "Incantatore/Incantatrice/Incantator*" | Primo anno | ottimo, il filo Harry Potter regge benissimo |
| `cast_50` | Lancia 50 incantesimi | Titolo "Magico/Magica/Magic*" | Secondo anno | idem |
| `cast_100` | Lancia 100 incantesimi | Sfondo "Arcano" + Titolo "Stregone/Strega/Streg*" | Terzo anno | idem |
| `mana_100` | Consuma almeno 100 Mana | Titolo "Spendaccione/Spendacciona/Spendaccion*" | Impossibile smettere | **Confessioni di uno shopaholic** (Sophie Kinsella) |
| `mana_200` | Consuma almeno 200 Mana | Variante elemento "Mana" | Senza freni | **Senza freni** — o, in tema con quello sopra: **Il conto è salato** |
| `cast_all_spells` | Lancia, almeno una volta, tutti gli Incantesimi | Dorso "Arcimago" | Esame finale | per chiudere il filo "Primo/Secondo/Terzo anno": **Il diploma** (fine del percorso a Hogwarts) |

## Combattimento

| Id obiettivo | Metrica · Soglia | Ricompensa attuale | Titolo proposto | Suggerimento |
| --- | --- | --- | --- | --- |
| `damage_50` | Infliggi almeno 50 danni in totale | Titolo "Ostile" | Primo sangue | **Prima sangue** (*First Blood*, Rambo) |
| `damage_100` | Infliggi almeno 100 danni in totale | Titolo "Pericoloso/Pericolosa/Pericolos*" | Senza pietà | **Kill Bill** (Tarantino) — o, più soft: **Senza pietà** |
| `damage_500` | Infliggi almeno 500 danni in totale | Titolo "della Magia Nera" | Magia nera | alternativa che lega al filo Harry Potter di "Incantesimi": **Le arti oscure** |
| `heal_50` | Cura almeno 50 punti ferita in totale | Titolo "Attento/Attenta/Attent*" | Fattore rigenerante | **Fattore rigenerante** (il potere di Wolverine) |
| `heal_100` | Cura almeno 100 punti ferita in totale | Titolo "Resistente" | Fatto d'acciaio | **Fatto d'acciaio** (*Man of Steel*/Superman) |
| `heal_500` | Cura almeno 500 punti ferita in totale | Titolo "della Magia Bianca" | Magia bianca | alternativa in tema Harry Potter: **Lacrime di fenice** |
| `shield_gain_10` | Attiva 10 Scudi | Titolo "In difesa" | Costruire un rifugio | alternativa: **Fatto di vibranio** (lo scudo di Captain America) |
| `shield_gain_50` | Attiva 50 Scudi | Titolo "In guardia" | In mezzo a loro | alternativa: **Alle Termopili** (*300*, i trecento Spartani a scudi spiegati) |
| `shield_gain_100` | Attiva 100 Scudi | Titolo "La muraglia" | La Barriera | la ricompensa è già "La Muraglia": puoi citarla anche nel trofeo con **La Barriera** (*Game of Thrones*) o **Il Muro** (Pink Floyd) |
| `shield_remove_10` | Rimuovi 10 Scudi all'avversario | Titolo "Spezzadifese" | Ariete | ottimo, tieni pure |
| `shield_remove_50` | Rimuovi 50 Scudi all'avversario | Titolo "Distruttore/Distruttrice/Distruttor*" | Abbattere i muri | già un'eco del discorso di Reagan ("Abbatti questo muro!") — se vuoi renderlo più esplicito: **Giù quel muro** |
