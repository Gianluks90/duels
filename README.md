# Duels

## Prossimi passi

Changelog dettagliato (tutto ciò che è già stato fatto) archiviato in [documentation/todo-archive-2026-07-21.md](documentation/todo-archive-2026-07-21.md) — qui restano solo i punti ancora aperti.

1. **Lava (2.3.3)** — manca ancora un `SpellEffectType` per "consumare carte dal proprio mazzo per alleggerirlo"; oggi solo la metà scudo (`shield_add`) è coperta. Tuono è invece completo (`lightning_bolt`/`damage_ignore_shields` ignorano già lo scudo del bersaglio).
2. **Debito tecnico**: l'`effect()` di auto-avanzamento per l'avversario di debug in `board.component.ts` va rimosso/sostituito appena esiste un modo vero di testare con un secondo client reale (o un'IA vera).

## Qualità della vita

- [x] Loader alla board per il refresh.
- [x] Log eventi (azioni/danni/scarti consultabile a schermo).
- [x] Rivedere opzioni profilo utente — la dialog profilo è ferma alla v1 (nome, foto, dorso, elimina account); da rivedere/espandere.
- [x] Sfondo app e duello personalizzabili — permettere all'utente di scegliere/personalizzare lo sfondo dell'applicazione e quello della board di duello.
- [x] Conteggio turno anzichè "Turno di: nome-giocatore";
- [ ] Magie preferite — un modo per il giocatore di segnare alcuni incantesimi come preferiti (Grimorio?).
- [ ] Magie pinnabili con tooltip in duel UI — poter "appuntare" un incantesimo durante il duello con un tooltip a schermo, per riferimento rapido senza dover riaprire il Grimorio.
- [x] Regolamento — manca una pagina di glossario e una di glossario icone. Inoltre va controllato che tutto sia in linea con quanto sviluppato. Potrebbe essere anche bello includere le immagini di qualche carta per essere più esplicativi.

## Future espansioni (idee da valutare)

- **`element_immunity`** — unico `SpellEffectType` del catalogo non ancora risolto, rimandato deliberatamente: richiede un vero sistema di stati a scadenza sul giocatore (non sulla singola carta, come `Card.expiresAt`), oggi inesistente. Da riprendere con una futura espansione dedicata, "Status e magie continue".
- **Paura** - nuovo effetto assieme a Veleno e Congelamento che può essere applicato al bersaglio. Nella fase preparazione, per ogni segnalino paura (max 3) viene scartata 1 carta. L'effetto si riduce di 1 durante la preparazione (dopo aver applicato l'effetto) oppure si riduce per intero dopo aver applicato l'effetto (da valutare).
- **Scuole di magia** - dare una categoria alle magie consentirebbe di creare formule più diversificate pur mantenendo lo stesso effetto oltre a creare un nuovo elemento che può essere coinvolto negli effetti degli incantesimi (es. +1 danno alle magie di Elementalismo). Associato a questa novità potrebbero essere inclusi gli "Equipaggiamenti", l'unico modo per diversificare un giocatore dall'altro.
- **Rituali** - Magie che una volta lanciate hanno effetto ogni turno.
- **Evocazioni** - Magie più potenti che vanno lanciate e poi potenziate per ottenere un effetto nel futuro.

## Da valutare

- Valutare "scarta invece di subire danno" come alternativa al danno automatico dell'esplosione elementale, se il playtest lo suggerisce.
- Tematizzare meglio `damage_self` (oggi usato solo da `black_flame`) quando arriveranno le scuole di magia come categoria narrativa.
- [ ] Tooltip Giocatore con preview del profilo in Duello. Da implementare quando avremo elementi di personalizzazione del profilo più ricchi (es. sfondo, dorso, ecc.).
