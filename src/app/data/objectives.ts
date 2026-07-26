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
 * Obiettivi "dentro una singola partita" o "transitori" (streak vittorie, congela l'avversario 10
 * volte in un duello, combina un Elemento Potente specifico, apprendi i 3 incantesimi di
 * rivelazione in mano, letto il regolamento, uso specifico della Fiamma Nera, scudi rimossi,
 * duello con un amico, login streak...) restano fuori da questo catalogo: richiedono
 * contatori/campi che UserStats/GameDoc non hanno ancora — v. "Casi limite" in README.
 */
export const OBJECTIVE_CATALOG: Objective[] = [
  { id: 'first_duel', metric: 'gamesPlayed', threshold: 1, rewards: [{ type: 'title', id: 'novice' }] },
  { id: 'first_win', metric: 'wins', threshold: 1, rewards: [{ type: 'title', id: 'apprentice' }] },
  { id: 'win_10', metric: 'wins', threshold: 10, rewards: [{ type: 'cardBack', id: 'golden' }] },
  { id: 'win_50', metric: 'wins', threshold: 50, rewards: [{ type: 'background', id: 'golden-fabric' }] },
  { id: 'played_50', metric: 'gamesPlayed', threshold: 50, rewards: [{ type: 'background', id: 'felt-fabric' }] },
  { id: 'lose_10', metric: 'losses', threshold: 10, rewards: [{ type: 'title', id: 'stubborn' }] },
  { id: 'collect_100', metric: 'cardsCollected', threshold: 100, rewards: [{ type: 'title', id: 'gatherer' }] },
  {
    id: 'collect_500',
    metric: 'cardsCollected',
    threshold: 500,
    rewards: [
      { type: 'background', id: 'TODO_collect_500' },
      { type: 'title', id: 'collector' },
    ],
  },
  { id: 'combine_10', metric: 'combinationsMade', threshold: 10, rewards: [{ type: 'title', id: 'mixologist' }] },
  {
    id: 'combine_50',
    metric: 'combinationsMade',
    threshold: 50,
    rewards: [
      { type: 'background', id: 'TODO_combine_50' },
      { type: 'title', id: 'alchemist' },
    ],
  },
  { id: 'cast_10', metric: 'spellsCast', threshold: 10, rewards: [{ type: 'title', id: 'enchanter' }] },
  { id: 'cast_50', metric: 'spellsCast', threshold: 50, rewards: [{ type: 'title', id: 'magical' }] },
  {
    id: 'cast_100',
    metric: 'spellsCast',
    threshold: 100,
    rewards: [
      { type: 'background', id: 'arcane' },
      { type: 'title', id: 'sorcerer' },
    ],
  },
  { id: 'damage_100', metric: 'damageDealt', threshold: 100, rewards: [{ type: 'title', id: 'dangerous' }] },
  { id: 'heal_100', metric: 'healingDone', threshold: 100, rewards: [{ type: 'title', id: 'resilient' }] },
];
