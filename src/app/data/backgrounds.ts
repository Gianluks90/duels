import type { RewardUnlock } from '../models/reward-unlock.model';

/**
 * Catalogo completo degli sfondi esistenti (arte reale già in public/images/backgrounds/<id>.webp
 * per tutti, id/file/free in public/config/backgrounds.json), ciascuno col proprio meccanismo di
 * sblocco — stesso schema di data/card-backs.ts. Le 4 voci 'free' devono combaciare con
 * backgrounds.json (BackgroundService legge da lì, non da qui): due fonti separate perché servono
 * a due cose diverse (qui: cosa mostrare in Collezione e come descriverlo; il json: quali sfondi
 * BackgroundService offre per l'applicazione live).
 */
export interface BackgroundDefinition {
  id: string;
  unlock: RewardUnlock;
}

export const BACKGROUND_CATALOG: BackgroundDefinition[] = [
  { id: 'dark-wood', unlock: { kind: 'free' } },
  { id: 'light-wood', unlock: { kind: 'free' } },
  { id: 'burn-wood', unlock: { kind: 'free' } },
  { id: 'slate', unlock: { kind: 'free' } },
  { id: 'golden-fabric', unlock: { kind: 'objective', objectiveId: 'win_50' } },
  { id: 'felt-fabric', unlock: { kind: 'objective', objectiveId: 'played_50' } },
  { id: 'arcane', unlock: { kind: 'objective', objectiveId: 'cast_100' } },
  { id: 'founder', unlock: { kind: 'purchase' } },
  // Riassegnato da 'seasonal' a collect_500 — stesso schema del dorso Dorato spostato da win_10 a
  // win_streak_5 (v. documentation/achievement-titles.md): l'arte esisteva già senza un vero
  // consumatore, "gioca N partite in un periodo" resta un'idea futura senza supporto nel motore.
  { id: 'amber', unlock: { kind: 'objective', objectiveId: 'collect_500' } },
];
