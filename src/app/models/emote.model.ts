/** Le 6 categorie fisse dell'emote wheel (ispirate a Hearthstone/MTG Arena) — un set chiuso, a
 * differenza di dorsi/sfondi/titoli non pensato per crescere in numero di categorie, solo nel
 * numero di frasi disponibili PER categoria (v. EMOTE_CATALOG in data/emotes.ts). */
export type EmoteCategory = 'greeting' | 'taunt' | 'compliment' | 'thanks' | 'sorry' | 'oops';

export const EMOTE_CATEGORIES: readonly EmoteCategory[] = [
  'greeting',
  'taunt',
  'compliment',
  'thanks',
  'sorry',
  'oops',
];

/** Slot equipaggiato dal giocatore per una categoria (v. UserProfile.equippedEmotes): una frase
 * (id di EMOTE_CATALOG) più, per uso futuro, uno sticker opzionale da abbinare — feature sticker non
 * ancora implementata, `stickerId` resta sempre null finché non lo è. */
export interface EmoteLoadoutSlot {
  emoteId: string;
  stickerId: string | null;
}
