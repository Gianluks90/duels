import type { CollectibleElement } from './element.model';
import type { UserStats } from './user.model';

/**
 * Tipo di ricompensa sbloccabile completando un obiettivo. Deliberatamente senza 'badge': nessuna
 * idea concreta al momento (v. documentation/achievements_ideas.md) — da riprendere quando ce ne
 * saranno da mostrare, non prima. 'cardBack' si affianca ai dorsi sbloccabili da codice riscatto
 * (AuthService.redeemCode) — le due strade restano indipendenti e possono coesistere sullo stesso
 * dorso in teoria, anche se nella pratica ogni dorso avrà una sola fonte di sblocco. 'elementVariant'
 * (arte v1 di un elemento, v. CollectionComponent.elementItems) non ha una fonte alternativa: a
 * differenza degli altri tre tipi, l'unico modo per ottenerla è completare il relativo obiettivo.
 */
export type ObjectiveRewardType = 'cardBack' | 'background' | 'title' | 'elementVariant';

export interface ObjectiveReward {
  type: ObjectiveRewardType;
  /** Id del dorso (public/config/card-backs.json, v. UserProfile.unlockedCardBacks), dello sfondo
   * (public/config/backgrounds.json, v. UserProfile.unlockedBackgrounds), del titolo (v.
   * UserProfile.unlockedTitles) o dell'elemento (un `CollectibleElement`, v.
   * UserProfile.unlockedElementVariants) sbloccato. */
  id: string;
}

/**
 * Metriche cumulative lifetime su cui può fondarsi un obiettivo — per lo più un sottoinsieme di
 * UserStats (esclude `spellCastCounts`/`elementsObtained`, mappe libere non contatori scalari
 * confrontabili con una soglia unica), più `loginStreak`/`rulebookRead`/`friendsCount`: campi che
 * vivono su UserProfile invece che su UserStats perché si aggiornano FUORI dal flusso di fine
 * partita (v. AuthService.ensureUserProfile/markRulebookRead/syncFriendsCount) —
 * game/achievements.ts.buildProgressSource() li converge comunque nello stesso formato numerico,
 * così ObjectiveCardComponent non deve sapere da dove viene ciascuna metrica. `element_<id>` (un
 * literal template type, un membro per ogni `CollectibleElement`) è la stessa idea applicata a
 * `UserStats.elementsObtained`: 11 proiezioni scalari della stessa mappa, una per elemento.
 */
export type ObjectiveMetric =
  | Exclude<keyof UserStats, 'spellCastCounts' | 'elementsObtained'>
  | 'loginStreak'
  | 'rulebookRead'
  | 'friendsCount'
  | `element_${CollectibleElement}`;

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
