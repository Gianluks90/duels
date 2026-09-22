import type { RewardUnlock } from '../models/reward-unlock.model';
import { EMOTE_CATEGORIES, type EmoteCategory, type EmoteLoadoutSlot } from '../models/emote.model';

/** Nasconde lo strumento emote (in game e il tab "Emotes" in Collezione) durante il beta test — le
 * frasi/categorie sotto sono comunque definite fin da ora, solo non mostrate. Invertire manualmente
 * (richiede un nuovo deploy: nessun remote-config in questo progetto, v. README) quando la feature
 * sarà pronta per il pubblico. */
export const EMOTES_FEATURE_ENABLED = false;

export interface EmoteDefinition {
  id: string;
  category: EmoteCategory;
  unlock: RewardUnlock;
}

/** Una sola frase gratuita per categoria per ora — stesso schema di CARD_BACK_CATALOG/
 * BACKGROUND_CATALOG (id + RewardUnlock), un catalogo condiviso da cui il giocatore ne equipaggia
 * UNA per categoria (v. UserProfile.equippedEmotes). Il testo reale vive in i18n
 * (collection.emoteCatalog.<id>.text), non qui, come per gli altri cataloghi collezionabili. */
export const EMOTE_CATALOG: EmoteDefinition[] = [
  { id: 'greeting_default', category: 'greeting', unlock: { kind: 'free' } },
  { id: 'taunt_default', category: 'taunt', unlock: { kind: 'free' } },
  { id: 'compliment_default', category: 'compliment', unlock: { kind: 'free' } },
  { id: 'thanks_default', category: 'thanks', unlock: { kind: 'free' } },
  { id: 'sorry_default', category: 'sorry', unlock: { kind: 'free' } },
  { id: 'oops_default', category: 'oops', unlock: { kind: 'free' } },
  // Pacchetto a tema "da programmatore", distribuito insieme al dorso 'de-bug' dallo stesso codice
  // riscatto (v. documentation/adding-collectibles.md, Ricetta 2) — variante sbloccabile per
  // categoria, non sostituisce i default sopra.
  { id: 'greeting_debug', category: 'greeting', unlock: { kind: 'redeemCode' } },
  { id: 'taunt_debug', category: 'taunt', unlock: { kind: 'redeemCode' } },
  { id: 'compliment_debug', category: 'compliment', unlock: { kind: 'redeemCode' } },
  { id: 'thanks_debug', category: 'thanks', unlock: { kind: 'redeemCode' } },
  { id: 'sorry_debug', category: 'sorry', unlock: { kind: 'redeemCode' } },
  { id: 'oops_debug', category: 'oops', unlock: { kind: 'redeemCode' } },
];

/** Slot di default equipaggiato per ogni categoria finché il profilo non ne specifica uno diverso
 * (v. UserProfile.equippedEmotes) — sempre l'unica voce 'free' del catalogo per quella categoria. */
export const DEFAULT_EQUIPPED_EMOTES: Record<EmoteCategory, EmoteLoadoutSlot> = Object.fromEntries(
  EMOTE_CATEGORIES.map((category) => [
    category,
    { emoteId: `${category}_default`, stickerId: null } satisfies EmoteLoadoutSlot,
  ]),
) as Record<EmoteCategory, EmoteLoadoutSlot>;
