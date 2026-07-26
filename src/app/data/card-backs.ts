import type { RewardUnlock } from '../models/reward-unlock.model';

/**
 * Catalogo completo dei dorsi carta esistenti (arte reale già in public/cards-back/<id>.webp per
 * tutti), ciascuno con il proprio meccanismo di sblocco — a differenza di sfondi/titoli (ancora
 * tutti placeholder), i dorsi sono il primo reward con contenuto vero. Le due voci 'free' devono
 * combaciare con public/config/card-backs.json (CardBackPickerComponent le legge da lì, non da
 * qui): due fonti separate perché servono a due cose diverse (qui: cosa mostrare in Collezione e
 * come descriverlo; il json: quali dorsi il picker propone).
 */
export interface CardBackDefinition {
  id: string;
  unlock: RewardUnlock;
}

export const CARD_BACK_CATALOG: CardBackDefinition[] = [
  { id: 'dark', unlock: { kind: 'free' } },
  { id: 'light', unlock: { kind: 'free' } },
  { id: 'golden', unlock: { kind: 'objective', objectiveId: 'win_10' } },
  { id: 'books', unlock: { kind: 'redeemCode' } },
  { id: 'founder', unlock: { kind: 'purchase' } },
  { id: 'summer', unlock: { kind: 'seasonal' } },
];
