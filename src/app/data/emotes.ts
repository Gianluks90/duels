import type { RewardUnlock } from '../models/reward-unlock.model';
import { EMOTE_CATEGORIES, type EmoteCategory, type EmoteLoadoutSlot } from '../models/emote.model';

/** Mostra lo strumento emote (in game e il tab "Emotes" in Collezione, con equip) — tenuto come
 * interruttore esplicito (invece di rimuovere il flag) per poter nascondere di nuovo la feature con
 * un solo valore, senza remote-config in questo progetto (richiede comunque un nuovo deploy, v.
 * README), se dovesse servire disattivarla in fretta. */
export const EMOTES_FEATURE_ENABLED = true;

export interface EmoteDefinition {
  id: string;
  category: EmoteCategory;
  unlock: RewardUnlock;
}

/** Più frasi per categoria — stesso schema di CARD_BACK_CATALOG/BACKGROUND_CATALOG (id +
 * RewardUnlock), un catalogo condiviso da cui il giocatore ne equipaggia UNA per categoria (v.
 * UserProfile.equippedEmotes). Il testo reale vive in i18n (collection.emoteCatalog.<id>.text), non
 * qui, come per gli altri cataloghi collezionabili. */
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
  // Contenuto aggiuntivo (2026-09-23): frasi in più per categoria, ancora senza una vera condizione
  // di sblocco decisa (arriverà legata a un obiettivo, come dorsi/sfondi/titoli) — `objectivePending`
  // (v. reward-unlock.model.ts) le mostra in Collezione già bloccate, con un messaggio esplicito
  // invece di un obiettivo inventato. Quando si deciderà quello giusto per ciascuna, sostituire con
  // `{ kind: 'objective', objectiveId: '...' }` (v. Ricetta 5/6 in
  // documentation/adding-collectibles.md) — nessuna modifica a firestore.rules necessaria in
  // nessuno dei due sensi: `objectivePending` non è mai in freeEmotes() né in unlockedEmotes, quindi
  // resta bloccato di suo finché non diventa un vero `objective`.
  { id: 'greeting_hi', category: 'greeting', unlock: { kind: 'objectivePending' } },
  { id: 'greeting_here_we_go', category: 'greeting', unlock: { kind: 'objectivePending' } },
  { id: 'greeting_nice_day', category: 'greeting', unlock: { kind: 'objectivePending' } },
  { id: 'greeting_good_luck', category: 'greeting', unlock: { kind: 'objectivePending' } },
  { id: 'greeting_lets_play', category: 'greeting', unlock: { kind: 'objectivePending' } },
  { id: 'taunt_best_move', category: 'taunt', unlock: { kind: 'objectivePending' } },
  { id: 'taunt_goat', category: 'taunt', unlock: { kind: 'objectivePending' } },
  { id: 'taunt_not_great', category: 'taunt', unlock: { kind: 'objectivePending' } },
  { id: 'taunt_is_that_all', category: 'taunt', unlock: { kind: 'objectivePending' } },
  { id: 'compliment_skilled', category: 'compliment', unlock: { kind: 'objectivePending' } },
  { id: 'compliment_unexpected', category: 'compliment', unlock: { kind: 'objectivePending' } },
  { id: 'compliment_gg', category: 'compliment', unlock: { kind: 'objectivePending' } },
  { id: 'compliment_wow', category: 'compliment', unlock: { kind: 'objectivePending' } },
  { id: 'thanks_appreciate', category: 'thanks', unlock: { kind: 'objectivePending' } },
  { id: 'thanks_pleasure', category: 'thanks', unlock: { kind: 'objectivePending' } },
  { id: 'thanks_kind', category: 'thanks', unlock: { kind: 'objectivePending' } },
  { id: 'thanks_thx', category: 'thanks', unlock: { kind: 'objectivePending' } },
  { id: 'sorry_regret', category: 'sorry', unlock: { kind: 'objectivePending' } },
  { id: 'sorry_no_intent', category: 'sorry', unlock: { kind: 'objectivePending' } },
  { id: 'sorry_apologize', category: 'sorry', unlock: { kind: 'objectivePending' } },
  { id: 'sorry_not_on_purpose', category: 'sorry', unlock: { kind: 'objectivePending' } },
  { id: 'oops_shrug', category: 'oops', unlock: { kind: 'objectivePending' } },
  { id: 'oops_not_sorry', category: 'oops', unlock: { kind: 'objectivePending' } },
  { id: 'oops_honestly', category: 'oops', unlock: { kind: 'objectivePending' } },
  { id: 'oops_so_sorry', category: 'oops', unlock: { kind: 'objectivePending' } },
];

/** Slot di default equipaggiato per ogni categoria finché il profilo non ne specifica uno diverso
 * (v. UserProfile.equippedEmotes) — sempre l'unica voce 'free' del catalogo per quella categoria. */
export const DEFAULT_EQUIPPED_EMOTES: Record<EmoteCategory, EmoteLoadoutSlot> = Object.fromEntries(
  EMOTE_CATEGORIES.map((category) => [
    category,
    { emoteId: `${category}_default`, stickerId: null } satisfies EmoteLoadoutSlot,
  ]),
) as Record<EmoteCategory, EmoteLoadoutSlot>;
