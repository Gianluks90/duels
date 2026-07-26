import type { Objective } from '../models/objective.model';

/**
 * Catalogo obiettivi (Achievements) — mirror di SPELL_CATALOG: ogni soglia sulla stessa metrica è
 * una entry separata (es. 'win_10'/'win_50' sono due obiettivi su `wins`, non un contatore dedicato
 * ciascuno), v. README "Achievements".
 *
 * I `reward.id` sono PLACEHOLDER — struttura decisa, contenuto no: gli sfondi dipendono da asset
 * ancora da ottimizzare/registrare in public/config/backgrounds.json, i titoli da un testo
 * definitivo mai scelto. Da sostituire prima di mostrare qualunque UI reale (Collezione, colonna
 * fine partita) o gli utenti vedrebbero questi id grezzi.
 *
 * Obiettivi "dentro una singola partita" o "transitori" (congela l'avversario 10 volte in un
 * duello, combina un Elemento Potente Oscurità/Luce, apprendi i 3 incantesimi di rivelazione in
 * mano, login streak, duello con un amico...) restano fuori da questo catalogo: richiedono
 * contatori/campi che UserStats/GameDoc non hanno ancora — v. "Casi limite" in README.
 */
export const OBJECTIVE_CATALOG: Objective[] = [
  { id: 'first_duel', metric: 'gamesPlayed', threshold: 1, reward: { type: 'title', id: 'TODO_first_duel' } },
  { id: 'first_win', metric: 'wins', threshold: 1, reward: { type: 'title', id: 'TODO_first_win' } },
  { id: 'win_10', metric: 'wins', threshold: 10, reward: { type: 'title', id: 'TODO_win_10' } },
  { id: 'win_50', metric: 'wins', threshold: 50, reward: { type: 'background', id: 'TODO_win_50' } },
  { id: 'lose_10', metric: 'losses', threshold: 10, reward: { type: 'title', id: 'TODO_lose_10' } },
  { id: 'collect_100', metric: 'cardsCollected', threshold: 100, reward: { type: 'title', id: 'TODO_collect_100' } },
  { id: 'collect_500', metric: 'cardsCollected', threshold: 500, reward: { type: 'background', id: 'TODO_collect_500' } },
  { id: 'combine_10', metric: 'combinationsMade', threshold: 10, reward: { type: 'title', id: 'TODO_combine_10' } },
  { id: 'combine_50', metric: 'combinationsMade', threshold: 50, reward: { type: 'background', id: 'TODO_combine_50' } },
  { id: 'cast_10', metric: 'spellsCast', threshold: 10, reward: { type: 'title', id: 'TODO_cast_10' } },
  { id: 'cast_50', metric: 'spellsCast', threshold: 50, reward: { type: 'title', id: 'TODO_cast_50' } },
  { id: 'cast_100', metric: 'spellsCast', threshold: 100, reward: { type: 'background', id: 'TODO_cast_100' } },
  { id: 'damage_100', metric: 'damageDealt', threshold: 100, reward: { type: 'title', id: 'TODO_damage_100' } },
  { id: 'heal_100', metric: 'healingDone', threshold: 100, reward: { type: 'title', id: 'TODO_heal_100' } },
];
