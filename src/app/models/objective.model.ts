import type { UserStats } from './user.model';

/**
 * Tipo di ricompensa sbloccabile completando un obiettivo. Deliberatamente senza 'badge': nessuna
 * idea concreta al momento (v. documentation/achievements_ideas.md) — da riprendere quando ce ne
 * saranno da mostrare, non prima. 'cardBack' si affianca ai dorsi sbloccabili da codice riscatto
 * (AuthService.redeemCode) — le due strade restano indipendenti e possono coesistere sullo stesso
 * dorso in teoria, anche se nella pratica ogni dorso avrà una sola fonte di sblocco.
 */
export type ObjectiveRewardType = 'cardBack' | 'background' | 'title';

export interface ObjectiveReward {
  type: ObjectiveRewardType;
  /** Id del dorso (public/config/card-backs.json, v. UserProfile.unlockedCardBacks), dello sfondo
   * (public/config/backgrounds.json, v. UserProfile.unlockedBackgrounds) o del titolo (v.
   * UserProfile.unlockedTitles) sbloccato. */
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
  /** Un obiettivo può dare più ricompense insieme (es. sia uno sfondo sia un titolo per lo stesso
   * traguardo) — AuthService.claimObjective() le accredita tutte in un solo riscatto/scrittura. */
  rewards: ObjectiveReward[];
  /** true = condizione di sblocco segreta: la UI (ObjectiveCardComponent, CollectionComponent)
   * mostra "???" invece di metrica/soglia finché l'obiettivo non è completato — il giocatore sa
   * comunque che lo slot esiste (v. richiesta esplicita "il giocatore deve sapere che ci sono").
   * Assente/false = condizione sempre visibile (comportamento di default, retrocompatibile con gli
   * obiettivi già scritti prima di questo campo). */
  hidden?: boolean;
}
