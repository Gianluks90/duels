import { CARD_PATTERN_CATALOG } from './card-patterns';
import { COLLECTIBLE_ELEMENT_IDS } from './elements';
import type { ObjectiveMetric } from '../models/objective.model';

export interface ObjectiveCategory {
  id: string;
  labelKey: string;
  metrics: readonly ObjectiveMetric[];
}

/**
 * Raggruppamento delle metriche di ObjectiveMetric in categorie per la nav a sinistra della
 * pagina Obiettivi (objectives.component.ts) — non 1:1 con le metriche: `loginStreak`/
 * `rulebookRead`/`friendsCount` condividono "Attività" (prima voce della nav) — non riguardano una
 * singola partita ma l'account nel tempo; `gamesPlayed`/`wins`/`losses`/`currentWinStreak`/
 * `friendDuelsPlayed`/`friendDuelWins` condividono "Esito duello" (questi ultimi due riguardano CON
 * chi si è duellato, diverso da `friendsCount` sopra che conta QUANTI amici si hanno);
 * `cardsCollected`/`combinationsMade` condividono "Azioni comuni"; gli 11 `element_<id>` (uno per
 * `COLLECTIBLE_ELEMENT_IDS`, v. data/elements.ts) condividono "Elementi" — la scomposizione per
 * elemento di combinationsMade/cardsCollected sopra, categoria a parte perché sono tanti (13
 * obiettivi: 2 titoli + 11 varianti) e affollerebbero "Azioni comuni"; `damageDealt`/`healingDone`/
 * `shieldsGained`/`shieldsRemoved`/`freezeApplied`/`poisonApplied`/`poisonFinishWins` condividono
 * "Combattimento" (ex "Cure e Danni" — rinominata quando gli scudi si sono aggiunti a danno/cura,
 * non ci stavano più sotto quel nome; destinata a crescere ancora, v. README);
 * `tipHeld`/`bodySocketed`/`handleSocketed`/`wandActionsTotal` hanno invece una categoria propria,
 * "Bacchetta" (v. documentation/achievement-titles.md) — meccanica abbastanza diversa da tutto il
 * resto da meritare una nav a parte, non infilata in "Combattimento";
 * `spellsCast`/`manaConsumed`/`distinctSpellsCast` condividono
 * "Incantesimi" (etichetta più corta di quella usata sulla singola card,
 * `objectives.metricLabels.spellsCast`, "Incantesimi lanciati · <soglia>") — `manaConsumed` (mana
 * speso lanciando, "Spendaccione"/variante "Mana (V1)") e `distinctSpellsCast` (incantesimi diversi
 * lanciati almeno una volta, "Arcimago") sono entrambi derivati dallo stesso flusso di lancio
 * incantesimi di `spellsCast`, quindi restano nella stessa categoria invece di averne una propria.
 * Per questo ogni categoria ha una propria chiave dedicata (`objectives.categories.<id>`) invece di
 * riusare metricLabels. L'ordine qui è l'ordine della nav.
 */
export const OBJECTIVE_CATEGORY_CATALOG: readonly ObjectiveCategory[] = [
  {
    id: 'activity',
    labelKey: 'objectives.categories.activity',
    metrics: ['loginStreak', 'rulebookRead', 'friendsCount'],
  },
  {
    id: 'duelOutcome',
    labelKey: 'objectives.categories.duelOutcome',
    metrics: [
      'gamesPlayed',
      'wins',
      'losses',
      'currentWinStreak',
      'friendDuelsPlayed',
      'friendDuelWins',
    ],
  },
  {
    id: 'commonActions',
    labelKey: 'objectives.categories.commonActions',
    metrics: ['cardsCollected', 'combinationsMade'],
  },
  {
    id: 'elements',
    labelKey: 'objectives.categories.elements',
    metrics: COLLECTIBLE_ELEMENT_IDS.map((id): ObjectiveMetric => `element_${id}`),
  },
  {
    id: 'spellsCast',
    labelKey: 'objectives.categories.spellsCast',
    metrics: ['spellsCast', 'manaConsumed', 'distinctSpellsCast'],
  },
  {
    id: 'combat',
    labelKey: 'objectives.categories.combat',
    metrics: [
      'damageDealt',
      'healingDone',
      'shieldsGained',
      'shieldsRemoved',
      'freezeApplied',
      'poisonApplied',
      'poisonFinishWins',
    ],
  },
  // Pattern di composizione mazzo (CARD_PATTERN_CATALOG, data/card-patterns.ts) — a differenza di
  // ogni categoria sopra, non un ObjectiveMetric fisso ma generato dal catalogo: cresce da solo
  // quando si aggiunge un pattern nuovo, stesso principio di 'elements' sopra con
  // COLLECTIBLE_ELEMENT_IDS.
  {
    id: 'deck',
    labelKey: 'objectives.categories.deck',
    metrics: CARD_PATTERN_CATALOG.map((pattern): ObjectiveMetric => `pattern_${pattern.id}`),
  },
  // "Bacchetta" (documentation/achievement-titles.md) — trattenere alla punta/incastonare asta o
  // manico, più il traguardo complessivo (wandActionsTotal, dorso "wands").
  {
    id: 'wand',
    labelKey: 'objectives.categories.wand',
    metrics: [
      'tipHeld',
      'bodySocketed',
      'handleSocketed',
      'wandActionsTotal',
      'selfDamageResisted',
      'wandDamageResisted',
      'selfVulnerableWins',
    ],
  },
];
