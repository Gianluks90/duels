import type { UserStats } from './user.model';

/**
 * Tipo di ricompensa sbloccabile completando un obiettivo. Deliberatamente senza 'badge': nessuna
 * idea concreta al momento (v. documentation/achievements_ideas.md) — da riprendere quando ce ne
 * saranno da mostrare, non prima.
 */
export type ObjectiveRewardType = 'background' | 'title';

export interface ObjectiveReward {
  type: ObjectiveRewardType;
  /** Id dello sfondo (public/config/backgrounds.json, v. UserProfile.unlockedBackgrounds) o del
   * titolo (v. UserProfile.unlockedTitles) sbloccato. */
  id: string;
}

/**
 * Metriche cumulative lifetime su cui può fondarsi un obiettivo — sottoinsieme di UserStats:
 * esclude `spellCastCounts` (mappa libera per-incantesimo, non un contatore scalare confrontabile
 * con una soglia unica).
 */
export type ObjectiveMetric = Exclude<keyof UserStats, 'spellCastCounts'>;

export interface Objective {
  id: string;
  metric: ObjectiveMetric;
  threshold: number;
  reward: ObjectiveReward;
}
