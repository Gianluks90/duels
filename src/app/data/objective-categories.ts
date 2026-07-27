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
 * `shieldsGained`/`shieldsRemoved` condividono "Combattimento" (ex "Cure e Danni" — rinominata
 * quando gli scudi si sono aggiunti a danno/cura, non ci stavano più sotto quel nome; destinata a
 * crescere ancora, v. README); `spellsCast` resta da sola ma con un'etichetta più corta
 * ("Incantesimi") di quella usata sulla singola card (`objectives.metricLabels.spellsCast`,
 * "Incantesimi lanciati · <soglia>"). Per questo ogni categoria ha una propria chiave dedicata
 * (`objectives.categories.<id>`) invece di riusare metricLabels. L'ordine qui è l'ordine della nav.
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
  { id: 'spellsCast', labelKey: 'objectives.categories.spellsCast', metrics: ['spellsCast'] },
  {
    id: 'combat',
    labelKey: 'objectives.categories.combat',
    metrics: ['damageDealt', 'healingDone', 'shieldsGained', 'shieldsRemoved'],
  },
];
