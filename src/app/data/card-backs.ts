import type { RewardUnlock } from '../models/reward-unlock.model';

/**
 * Catalogo completo dei dorsi carta esistenti (arte reale già in public/cards-back/<id>.webp per
 * tutti), ciascuno con il proprio meccanismo di sblocco — a differenza di sfondi/titoli (ancora
 * tutti placeholder), i dorsi sono il primo reward con contenuto vero. L'unica voce 'free' deve
 * combaciare con freeCardBacks() in firestore.rules (mirror manuale, le regole non possono
 * importare questo modulo).
 *
 * 'light' NON è più gratuito (v. documentation/achievement-titles.md) — ora reward di `win_10`,
 * al posto di 'golden' (spostato su `win_streak_5`, dove si affianca al Titolo "Inarrestabile").
 * Rottura deliberata del principio "il gratuito resta gratuito per sempre" finora seguito (stesso
 * principio ancora valido per gli sfondi, v. freeBackgrounds() in firestore.rules) — accettata
 * consapevolmente: nessuna migrazione retroattiva per chi lo aveva già equipaggiato da gratuito
 * (cardBackValid() non lo strappa a chi lo ha già, ma chi lo cambia in futuro dovrà riguadagnarlo).
 */
export interface CardBackDefinition {
  id: string;
  unlock: RewardUnlock;
}

export const CARD_BACK_CATALOG: CardBackDefinition[] = [
  { id: 'dark', unlock: { kind: 'free' } },
  { id: 'light', unlock: { kind: 'objective', objectiveId: 'win_10' } },
  { id: 'golden', unlock: { kind: 'objective', objectiveId: 'win_streak_5' } },
  { id: 'books', unlock: { kind: 'redeemCode' } },
  { id: 'founder', unlock: { kind: 'purchase' } },
  { id: 'summer', unlock: { kind: 'seasonal' } },
  { id: 'archmage', unlock: { kind: 'objective', objectiveId: 'cast_all_spells' } },
  { id: 'de-bug', unlock: { kind: 'redeemCode' } },
  { id: 'friendship', unlock: { kind: 'inviteFriend' } },
  // "Non temo nulla" — l'unico dorso di questo catalogo che premia un azzardo deliberato invece di
  // grind/completismo (v. documentation/achievement-titles.md, "Bacchetta").
  { id: 'wands', unlock: { kind: 'objective', objectiveId: 'wand_self_vulnerable' } },
];
