import { SPELL_CATALOG } from './spells';
import type { Objective } from '../models/objective.model';

/**
 * Catalogo obiettivi (Achievements) — mirror di SPELL_CATALOG: ogni soglia sulla stessa metrica è
 * una entry separata (es. 'win_10'/'win_50' sono due obiettivi su `wins`, non un contatore dedicato
 * ciascuno), v. README "Achievements".
 *
 * Un obiettivo può dare più ricompense insieme (`rewards: ObjectiveReward[]`, v. modello) — usato
 * per `collect_500`/`combine_50`/`cast_100`, che davano già uno sfondo prima che i titoli avessero
 * contenuto reale: invece di scegliere quale reward "vince", danno entrambi.
 *
 * `hidden` (Objective.hidden, v. modello): nessun obiettivo qui lo usa ancora — tutti mostrano la
 * propria condizione (metrica · soglia). Da applicare quando deciderete quali sblocchi restare
 * segreti ("???" invece della condizione, ma lo slot resta comunque visibile).
 *
 * Obiettivi "dentro una singola partita" o "transitori" (congela l'avversario 10 volte in un
 * duello, apprendi i 3 incantesimi di rivelazione in mano, uso specifico della Fiamma Nera...)
 * restano fuori da questo catalogo: richiedono contatori/campi che UserStats/GameDoc non hanno
 * ancora — v. "Casi limite" in README. `win_streak_5`/`friend_duel_1`/`friend_duel_wins_5`/
 * `shield_gain_10`/`shield_gain_50`/`shield_gain_100`/`shield_remove_10`/`shield_remove_50`/
 * `rulebook_read`/`login_streak_7`/`friends_1`/`friends_5`/`combine_dark_5`/`combine_light_5`/
 * `variant_*` (11 voci) sotto sono invece quelli di quella lista ad aver ricevuto il contatore
 * necessario (`UserStats.currentWinStreak`/`friendDuelsPlayed`/`friendDuelWins`/`shieldsGained`/
 * `shieldsRemoved`/`elementsObtained`, `UserProfile.rulebookRead`/`loginStreak`/`friendsCount`/
 * `unlockedElementVariants` — v. user.model.ts). `friend_duel_1`/`friend_duel_wins_5`
 * ("Amichevole"/"Rivale") si basano su `GameDoc.wasFriendDuel`, uno snapshot preso al join (v.
 * GameService.joinGame) — diverso da `friends_1`/`friends_5` sopra, che contano QUANTI amici si
 * hanno, non con CHI si è duellato. `shield_gain_*`/`shield_remove_*` ("In difesa"/"In guardia"/"La
 * muraglia"/"Spezzadifese"/"Distruttore") contano il VALORE di scudo guadagnato/rimosso
 * (`GameLogEntryData.shieldGained`/`shieldRemoved`, entrambi con `amount` REALE, mai il valore
 * nominale dell'incantesimo — v. applyShieldRemove in turn-engine.ts), non le volte in cui
 * l'incantesimo è stato lanciato: Breccia rimuove tutto lo scudo presente qualunque esso sia, non un
 * valore fisso contabile per cast. `combine_dark_5`/`combine_light_5` ("Oscuro"/"Oscura"/
 * "Luminoso"/"Luminosa") e i `variant_*` ("Variante 'Elemento X'", una per `COLLECTIBLE_ELEMENT_IDS`
 * in data/elements.ts) condividono lo STESSO contatore per elemento (`elementsObtained`, soglia 5
 * per il titolo su dark/light) — alimentato da `GameLogEntryData.cardCollected` per i 4 elementi
 * base (mai il risultato di una combinazione) e da `combined` per gli altri 7 (mai pescati dalla
 * Fonte comune): le due fonti non si sovrappongono mai per lo stesso elemento. La soglia della
 * variante varia per tier — più raro l'elemento, meno ne servono: 50 per i 4 base (fire/water/air/
 * earth), 25 per i 4 avanzati (thunder/poison/ice/lava) e il Residuo Arcano, 15 per i 2 potenti
 * (light/dark). `mana_100`/`mana_200`/`cast_all_spells` sono l'ultimo gruppo ad aver ricevuto il
 * contatore necessario (`UserStats.manaConsumed`, e la proiezione derivata `distinctSpellsCast` — v.
 * ObjectiveMetric/buildProgressSource). `mana_100`/`mana_200` ("Spendaccione"/"Spendacciona"/
 * "Spendaccion*", variante "Mana (V1)") condividono lo stesso contatore `manaConsumed`, stesso
 * rapporto di `combine_dark_5`/`variant_dark` sopra: un titolo a soglia più bassa, la variante v1 a
 * soglia più alta sullo stesso traguardo. `cast_all_spells` ("Arcimago") usa invece
 * `distinctSpellsCast`, non `spellsCast`: incantesimi DIVERSI lanciati almeno una volta, non il
 * totale di lanci.
 */
export const OBJECTIVE_CATALOG: Objective[] = [
  {
    id: 'first_duel',
    metric: 'gamesPlayed',
    threshold: 1,
    rewards: [{ type: 'title', id: 'novice' }],
  },
  { id: 'first_win', metric: 'wins', threshold: 1, rewards: [{ type: 'title', id: 'apprentice' }] },
  { id: 'win_10', metric: 'wins', threshold: 10, rewards: [{ type: 'cardBack', id: 'golden' }] },
  {
    id: 'win_50',
    metric: 'wins',
    threshold: 50,
    rewards: [{ type: 'background', id: 'golden-fabric' }],
  },
  {
    id: 'played_50',
    metric: 'gamesPlayed',
    threshold: 50,
    rewards: [{ type: 'background', id: 'felt-fabric' }],
  },
  { id: 'lose_10', metric: 'losses', threshold: 10, rewards: [{ type: 'title', id: 'stubborn' }] },
  {
    id: 'win_streak_5',
    metric: 'currentWinStreak',
    threshold: 5,
    rewards: [{ type: 'title', id: 'unstoppable' }],
  },
  {
    id: 'friend_duel_1',
    metric: 'friendDuelsPlayed',
    threshold: 1,
    rewards: [{ type: 'title', id: 'buddy' }],
  },
  {
    id: 'friend_duel_wins_5',
    metric: 'friendDuelWins',
    threshold: 5,
    rewards: [{ type: 'title', id: 'rival' }],
  },
  {
    id: 'collect_100',
    metric: 'cardsCollected',
    threshold: 100,
    rewards: [{ type: 'title', id: 'gatherer' }],
  },
  {
    id: 'collect_500',
    metric: 'cardsCollected',
    threshold: 500,
    rewards: [
      { type: 'background', id: 'TODO_collect_500' },
      { type: 'title', id: 'collector' },
    ],
  },
  {
    id: 'combine_10',
    metric: 'combinationsMade',
    threshold: 10,
    rewards: [{ type: 'title', id: 'mixologist' }],
  },
  {
    id: 'combine_50',
    metric: 'combinationsMade',
    threshold: 50,
    rewards: [
      { type: 'background', id: 'TODO_combine_50' },
      { type: 'title', id: 'alchemist' },
    ],
  },
  {
    // Soglia 15 (non 10 come nella bozza originale): a costo pressoché zero rispetto ad altri
    // obiettivi "incantesimi" più impegnativi, alzata leggermente per restare un traguardo, non un
    // gimme dei primi minuti. L'id segue la soglia corrente (come ogni altro obiettivo nel catalogo),
    // quindi è cambiato insieme — v. TITLE_CATALOG in data/titles.ts, aggiornato di conseguenza.
    id: 'cast_15',
    metric: 'spellsCast',
    threshold: 15,
    rewards: [{ type: 'title', id: 'enchanter' }],
  },
  {
    id: 'cast_50',
    metric: 'spellsCast',
    threshold: 50,
    rewards: [{ type: 'title', id: 'magical' }],
  },
  {
    id: 'cast_100',
    metric: 'spellsCast',
    threshold: 100,
    rewards: [
      { type: 'background', id: 'arcane' },
      { type: 'title', id: 'sorcerer' },
    ],
  },
  {
    id: 'damage_50',
    metric: 'damageDealt',
    threshold: 50,
    rewards: [{ type: 'title', id: 'hostile' }],
  },
  {
    id: 'damage_100',
    metric: 'damageDealt',
    threshold: 100,
    rewards: [{ type: 'title', id: 'dangerous' }],
  },
  {
    id: 'damage_500',
    metric: 'damageDealt',
    threshold: 500,
    rewards: [{ type: 'title', id: 'black_magic' }],
  },
  {
    id: 'heal_50',
    metric: 'healingDone',
    threshold: 50,
    rewards: [{ type: 'title', id: 'attentive' }],
  },
  {
    id: 'heal_100',
    metric: 'healingDone',
    threshold: 100,
    rewards: [{ type: 'title', id: 'resilient' }],
  },
  {
    id: 'heal_500',
    metric: 'healingDone',
    threshold: 500,
    rewards: [{ type: 'title', id: 'white_magic' }],
  },
  {
    id: 'shield_gain_10',
    metric: 'shieldsGained',
    threshold: 10,
    rewards: [{ type: 'title', id: 'defensive' }],
  },
  {
    id: 'shield_gain_50',
    metric: 'shieldsGained',
    threshold: 50,
    rewards: [{ type: 'title', id: 'on_guard' }],
  },
  {
    id: 'shield_gain_100',
    metric: 'shieldsGained',
    threshold: 100,
    rewards: [{ type: 'title', id: 'the_wall' }],
  },
  {
    // Soglie 10/50 (non 1/100 come nella bozza originale in documentation/titles.md): si conta il
    // VALORE di scudo rimosso, non le volte in cui l'incantesimo è stato lanciato (Breccia rimuove
    // tutto lo scudo presente, un valore variabile — v. UserStats.shieldsRemoved), quindi 100 come
    // seconda soglia sarebbe stato sproporzionato per un semplice titolo.
    id: 'shield_remove_10',
    metric: 'shieldsRemoved',
    threshold: 10,
    rewards: [{ type: 'title', id: 'shieldbreaker' }],
  },
  {
    id: 'shield_remove_50',
    metric: 'shieldsRemoved',
    threshold: 50,
    rewards: [{ type: 'title', id: 'destroyer' }],
  },
  {
    id: 'rulebook_read',
    metric: 'rulebookRead',
    threshold: 1,
    rewards: [{ type: 'title', id: 'educated' }],
  },
  {
    id: 'login_streak_7',
    metric: 'loginStreak',
    threshold: 7,
    rewards: [{ type: 'title', id: 'omnipresent' }],
  },
  {
    id: 'friends_1',
    metric: 'friendsCount',
    threshold: 1,
    rewards: [{ type: 'title', id: 'sociable_duelist' }],
  },
  {
    id: 'friends_5',
    metric: 'friendsCount',
    threshold: 5,
    rewards: [{ type: 'title', id: 'friendly_duelist' }],
  },
  {
    id: 'combine_dark_5',
    metric: 'element_dark',
    threshold: 5,
    rewards: [{ type: 'title', id: 'shadowbound' }],
  },
  {
    id: 'combine_light_5',
    metric: 'element_light',
    threshold: 5,
    rewards: [{ type: 'title', id: 'radiant' }],
  },
  // Le 11 "Variante" sotto: stessa soglia (25) per ognuna, un `Objective` per `CollectibleElement`
  // (v. data/elements.ts) — usano lo STESSO contatore di combine_dark_5/combine_light_5 sopra
  // (`element_dark`/`element_light`), solo con soglia più alta: un elemento può sia dare il titolo a
  // 5 sia la variante a 25, non sono percorsi alternativi.
  {
    id: 'variant_fire',
    metric: 'element_fire',
    threshold: 50,
    rewards: [{ type: 'elementVariant', id: 'fire' }],
  },
  {
    id: 'variant_water',
    metric: 'element_water',
    threshold: 50,
    rewards: [{ type: 'elementVariant', id: 'water' }],
  },
  {
    id: 'variant_air',
    metric: 'element_air',
    threshold: 50,
    rewards: [{ type: 'elementVariant', id: 'air' }],
  },
  {
    id: 'variant_earth',
    metric: 'element_earth',
    threshold: 50,
    rewards: [{ type: 'elementVariant', id: 'earth' }],
  },
  {
    id: 'variant_thunder',
    metric: 'element_thunder',
    threshold: 25,
    rewards: [{ type: 'elementVariant', id: 'thunder' }],
  },
  {
    id: 'variant_poison',
    metric: 'element_poison',
    threshold: 25,
    rewards: [{ type: 'elementVariant', id: 'poison' }],
  },
  {
    id: 'variant_ice',
    metric: 'element_ice',
    threshold: 25,
    rewards: [{ type: 'elementVariant', id: 'ice' }],
  },
  {
    id: 'variant_lava',
    metric: 'element_lava',
    threshold: 25,
    rewards: [{ type: 'elementVariant', id: 'lava' }],
  },
  {
    id: 'variant_light',
    metric: 'element_light',
    threshold: 15,
    rewards: [{ type: 'elementVariant', id: 'light' }],
  },
  {
    id: 'variant_dark',
    metric: 'element_dark',
    threshold: 15,
    rewards: [{ type: 'elementVariant', id: 'dark' }],
  },
  {
    // Nessun tier esplicito indicato per il Residuo Arcano — trattato come gli avanzati (nasce
    // sempre da una combinazione, mai pescato in Raccolta, stessa fonte di thunder/poison/ice/lava
    // sopra): da rivedere se si preferisce un'altra soglia.
    id: 'variant_residium',
    metric: 'element_residium',
    threshold: 25,
    rewards: [{ type: 'elementVariant', id: 'residium' }],
  },
  // Le 3 sotto ("Spendaccione"/"Spendacciona"/"Spendaccion*", variante "Mana (V1)", "Arcimago"):
  // tier alti apposta (v. `manaConsumed` in user.model.ts) perché si spendono minimo 2-6 mana a
  // lancio, mai 1 alla volta — un "consuma 10 mana" sarebbe stato raggiungibile nel primo duello.
  {
    id: 'mana_100',
    metric: 'manaConsumed',
    threshold: 100,
    rewards: [{ type: 'title', id: 'spendthrift' }],
  },
  // Stesso contatore di mana_100 sopra, soglia più alta — come `combine_dark_5`/`variant_dark`
  // condividono `element_dark`, un titolo a soglia bassa e la variante v1 a soglia più alta sullo
  // stesso traguardo. L'arte v1 (public/cards/v1/mana.webp) usa già lo stesso reward type
  // `elementVariant`/`unlockedElementVariants` degli 11 elementi veri — 'mana' non è un
  // `CollectibleElement` (v. element.model.ts, resta fuori da COLLECTIBLE_ELEMENT_IDS/category
  // "Elementi") ma la meccanica di sblocco/equip sotto è comunque identica, quindi non serve alcun
  // reward type o campo Firestore nuovo — v. CollectionComponent.manaItems.
  {
    id: 'mana_200',
    metric: 'manaConsumed',
    threshold: 200,
    rewards: [{ type: 'elementVariant', id: 'mana' }],
  },
  // "Lancia una volta ogni incantesimo" — soglia = l'intero SPELL_CATALOG, non un numero fisso a
  // mano: resta corretto da solo se si aggiungono nuovi incantesimi in futuro.
  {
    id: 'cast_all_spells',
    metric: 'distinctSpellsCast',
    threshold: SPELL_CATALOG.length,
    rewards: [{ type: 'cardBack', id: 'archmage' }],
  },
  // "Che tutto vede": le 3 magie di rivelazione (Terzo occhio/Occhio supremo/Occhio arcano —
  // third_eye/supreme_eye/spell_glimpse) possedute insieme a fine partita (v. pattern 'reveal_trio'
  // in CARD_PATTERN_CATALOG, data/card-patterns.ts) — valutato sullo stato finale del mazzo, non
  // sull'eventLog (v. game/achievements.ts computeCardPatternMatches), a differenza di ogni altro
  // obiettivo sopra.
  {
    id: 'reveal_trio',
    metric: 'pattern_reveal_trio',
    threshold: 1,
    rewards: [{ type: 'title', id: 'all_seeing' }],
  },
  // "Preparato a tutto"/"Preparata a tutto" (v. pattern 'all_elements' in CARD_PATTERN_CATALOG,
  // data/card-patterns.ts) — stesso principio di 'reveal_trio' sopra: valutato sullo stato finale
  // del mazzo, non sull'eventLog.
  {
    id: 'all_elements',
    metric: 'pattern_all_elements',
    threshold: 1,
    rewards: [{ type: 'title', id: 'prepared' }],
  },
  // "Fortunato"/"Fortunata"/"Fortunat*" (v. pattern 'lucky_win' in CARD_PATTERN_CATALOG,
  // data/card-patterns.ts) — stesso principio di 'reveal_trio'/'all_elements' sopra, ma con anche
  // `requireWin`: vale solo per il duello VINTO in quelle condizioni, non semplicemente giocato.
  {
    id: 'lucky_win',
    metric: 'pattern_lucky_win',
    threshold: 1,
    rewards: [{ type: 'title', id: 'lucky' }],
  },
  // "...della neve"/"...del ghiaccio"/"l'avvelenatore"/"...della Pestilenza": contatori lifetime
  // (UserStats.freezeApplied/poisonApplied), non un pattern-mazzo — stesso principio di
  // shieldsGained/shieldsRemoved sopra, derivati dall'eventLog di ogni partita (v.
  // game/achievements.ts computeStatsDelta), non dallo stato finale del mazzo.
  {
    id: 'freeze_50',
    metric: 'freezeApplied',
    threshold: 50,
    rewards: [{ type: 'title', id: 'snowy' }],
  },
  {
    id: 'freeze_100',
    metric: 'freezeApplied',
    threshold: 100,
    rewards: [{ type: 'title', id: 'icy' }],
  },
  {
    id: 'poison_50',
    metric: 'poisonApplied',
    threshold: 50,
    rewards: [{ type: 'title', id: 'poisoner' }],
  },
  {
    id: 'poison_100',
    metric: 'poisonApplied',
    threshold: 100,
    rewards: [{ type: 'title', id: 'plague' }],
  },
];
