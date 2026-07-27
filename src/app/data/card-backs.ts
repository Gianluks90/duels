import type { RewardUnlock } from '../models/reward-unlock.model';

/**
 * Catalogo completo dei dorsi carta esistenti (arte reale già in public/cards-back/<id>.webp per
 * tutti), ciascuno con il proprio meccanismo di sblocco — a differenza di sfondi/titoli (ancora
 * tutti placeholder), i dorsi sono il primo reward con contenuto vero. Le due voci 'free' devono
 * combaciare con freeCardBacks() in firestore.rules (mirror manuale, le regole non possono
 * importare questo modulo).
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
  { id: 'archmage', unlock: { kind: 'objective', objectiveId: 'cast_all_spells' } },
];
