# Incantesimi

Elenco completo degli incantesimi del catalogo (`src/app/data/spells.ts`), con formula, costo di lancio in mana ed effetti. Fonte di verità per nome/formula/costo/effetti è il codice — questo file va tenuto allineato manualmente quando il catalogo cambia.

**Difficoltà**: punteggio calcolato dalla formula di creazione, non dal costo di lancio in mana (i due sono deliberatamente slegati nel codice). Ogni ingrediente della formula pesa in base al proprio tipo (regolamento 2.1-2.4):

| Tipo ingrediente | Peso |
| --- | --- |
| Elemento base (Fuoco, Acqua, Aria, Terra) | 1 |
| Elemento avanzato (Ghiaccio, Tuono, Lava, Veleno) | 2 |
| Elemento potente (Luce, Tenebra) | 4 |

La Difficoltà è la somma dei pesi di tutti gli ingredienti della formula. `starter_bolt`/`starter_balm` non hanno una formula (sono seminati direttamente nel mazzo iniziale, non creabili dal grimorio): Difficoltà 0.

## Magie base mono-elemento (2.2)

Le 4 magie "livello 1" e le rispettive escalation a 3/4 copie dello stesso elemento base.

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Ustione leggera (`fire_bolt`) | Fuoco + Fuoco | Fuoco | 2 | 1 danno | 2 |
| Frusta d'Acqua (`water_lance`) | Acqua + Acqua | Acqua | 2 | 1 danno | 2 |
| Raffica d'Aria (`air_slash`) | Aria + Aria | Aria | 2 | 1 danno | 2 |
| Proiettile terreno (`earth_shard`) | Terra + Terra | Terra | 2 | 1 danno | 2 |
| Combustione (`combustion`) | Fuoco × 3 | Fuoco | 3 | 3 danni | 3 |
| Inferno (`inferno`) | Fuoco × 4 | Fuoco | 5 | 5 danni | 4 |
| Diluvio (`flood`) | Acqua × 3 | Acqua | 3 | 3 danni | 3 |
| Maremoto (`drowning`) | Acqua × 4 | Acqua | 5 | 5 danni | 4 |
| Turbine (`whirlwind`) | Aria × 3 | Aria | 3 | 3 danni | 3 |
| Tornado (`tornado`) | Aria × 4 | Aria | 5 | 5 danni | 4 |
| Frana (`rockfall`) | Terra × 3 | Terra | 3 | 3 danni | 3 |
| Terremoto (`landslide`) | Terra × 4 | Terra | 5 | 5 danni | 4 |

## Magie iniziali (mazzo di partenza, non creabili dal grimorio)

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Dardo incantato (`starter_bolt`) | — | — | 3 | 1 danno | 0 |
| Guarigione leggera (`starter_balm`) | — | — | 3 | 1 cura | 0 |

## Cura

Solo 2 livelli apposta (non una scala a 3 come le altre famiglie sotto) — troppa cura craftabile rischia di far stagnare la partita.

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Rugiada risanante (`mend`) | Acqua + Aria | — | 3 | +2 cura | 2 |
| Luce risanante (`radiant_heal`) | Luce + Acqua | — | 4 | +3 cura | 5 |

## Veleno (2.3.4)

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Spore (`spore`) | Veleno + Terra | — | 3 | +1 livello veleno | 3 |
| Tossina (`toxin`) | Veleno + Veleno | — | 4 | +2 livelli veleno | 4 |
| Pestilenza (`pestilence`) | Veleno + Veleno + Tenebra | — | 5 | +3 livelli veleno | 8 |

## Congelamento (2.3.1)

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Freddo (`frost`) | Ghiaccio + Acqua | — | 3 | +1 carta Congelamento | 3 |
| Brina (`blizzard`) | Ghiaccio + Ghiaccio | — | 4 | +2 carte Congelamento | 4 |
| Zero assoluto (`ice_age`) | Ghiaccio + Ghiaccio + Tenebra | — | 5 | +3 carte Congelamento | 8 |

## Scudo — Lava (2.3.3)

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Protezione (`protection`) | Lava + Terra | — | 3 | +2 scudo | 3 |
| Muro (`wall`) | Lava + Lava | — | 4 | +3 scudo | 4 |
| Egida (`aegis`) | Lava + Lava + Luce | — | 5 | +5 scudo | 8 |

## Anti-scudo — Lava (2.3.3)

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Frattura (`fracture`) | Lava + Fuoco | — | 3 | -2 scudo avversario | 3 |
| Breccia (`breach`) | Lava + Lava | — | 5 | azzera scudo avversario | 4 |

## Tuono (2.3.2)

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Scarica (`spark`) | Tuono + Aria | — | 3 | 2 danni, ignora scudi | 3 |
| Fulmine (`lightning_bolt`) | Tuono + Tuono | — | 4 | 3 danni, ignora scudi | 4 |
| Tempesta di fulmini (`thunderstorm`) | Tuono + Tuono + Tenebra | — | 5 | 5 danni, ignora scudi | 8 |

## Danno misto / Tenebra+Fuoco

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Fiamma nera (`black_flame`) | Tenebra + Fuoco | Fuoco | 2 | 4 danni a sé, 4 danni avversario | 5 |

## Cura di sé — Luce

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Calore (`heat`) | Luce + Ghiaccio | — | 3 | rimuove tutto il Congelamento proprio | 6 |
| Disintossicante (`detox`) | Luce + Veleno | — | 3 | rimuove tutto il veleno proprio | 6 |

## Tenebra pura

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Buco nero (`black_hole`) | Tenebra + Tenebra | — | 6 | dimezza gli HP correnti dell'avversario | 8 |

## Aria pura / controllo mano

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Raffica violenta (`violent_gust`) | Aria × 3 | — | 4 | l'avversario scarta 1 carta casuale | 3 |
| Raffica oscura (`dark_gust`) | Aria + Tenebra | — | 4 | l'avversario scarta 2 carte casuali | 5 |
| Colpo basso (`low_blow`) | Tenebra + Terra | — | 5 | l'avversario scarta tutta la mano e ripesca 5 carte | 5 |

## Occhio — rivela mano avversario

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Terzo occhio (`third_eye`) | Luce + Aria | — | 3 | rivela 1 carta casuale dell'avversario | 5 |
| Occhio arcano (`spell_glimpse`) | Luce + Fuoco | — | 3 | rivela 1 magia casuale nella mano dell'avversario (nessun effetto se non ne ha) | 5 |
| Occhio supremo (`supreme_eye`) | Luce + Luce | — | 6 | rivela l'intera mano dell'avversario | 8 |

## Fonte Arcana

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Reset (`reset`) | Tenebra + Aria | — | 4 | rigenera le 4 carte della Fonte Arcana | 5 |
| Rischio (`risk`) | Fuoco + Acqua + Aria + Terra | — | 2 | 3 danni per ogni coppia di elementi avanzati uguali visibile in Fonte Arcana (0-6, Luce/Tenebra escluse dal conteggio) | 4 |

## Altro

| Nome | Formula | Elemento | Mana | Effetti | Difficoltà |
| --- | --- | --- | --- | --- | --- |
| Migliora mana (`improve_mana`) | Luce + Tenebra | — | 5 | +1 mana permanente su una carta bersaglio scelta dai propri scarti (nessun effetto se gli scarti sono vuoti) | 8 |
