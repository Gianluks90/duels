import type { RewardUnlock } from '../models/reward-unlock.model';

/**
 * Manifest dei titoli con varianti di genere. In italiano molti titoli richiedono una forma
 * maschile e una femminile, più — per chi lo desidera — una forma neutra/inclusiva con
 * l'asterisco finale (es. "Istruit*"): il set di variant-id concessi da
 * `AuthService.claimObjective()` è fissato QUI, indipendente dalla lingua attiva al momento del
 * riscatto (le regole Firestore/`unlockedTitles` non devono dipendere da quale lingua l'utente
 * aveva caricato quel giorno). Ogni lingua traduce le stesse chiavi in
 * `collection.titleCatalog.<variantId>.name` (v. `TranslationService.titleForms`) — una lingua
 * senza questa distinzione (es. inglese) può ripetere lo stesso testo per tutte e tre le varianti.
 *
 * Titoli non elencati qui restano un id singolo invariante (stesso comportamento di sempre) —
 * `apprentice`/`mixologist`/`resilient`/`collector`/`alchemist`/`beginner` sono parole di genere
 * comune o invariabili in italiano ("un/una apprendista", "Mixologista", "Resistente",
 * "Collezionista", "Alchimista", "Principiante"), non hanno bisogno di varianti.
 *
 * Nota sulla forma neutra/inclusiva (`_x`): per le coppie in -o/-a (`novice`, `stubborn`,
 * `dangerous`, `magical`, `first_duelist`, `attentive`, `educated`, `buddy`, `shadowbound`,
 * `radiant`) è la sostituzione diretta della vocale finale con l'asterisco ("Novizi*", "Ostinat*",
 * "Attent*", "Istruit*", "Soci*", "Oscur*", "Luminos*"...). Per le coppie agentive in -tore/-trice
 * (`gatherer`, `enchanter`, `destroyer`) e per la coppia irregolare `sorcerer` (Stregone/Strega,
 * stesso stem "Streg-") si è scelta la convenzione "-tor*"/"Streg*" già in uso in alcuni contesti
 * (es. "lettor*" per lettore/lettrice) — v. collection.titleCatalog in it.json/en.json, facilmente
 * da rivedere se non convince.
 *
 * `hostile`/`black_magic`/`white_magic`/`unstoppable`/`omnipresent`/`sociable_duelist`/
 * `friendly_duelist`/`rival`/`defensive`/`on_guard`/`the_wall`/`shieldbreaker` restano invarianti
 * come `resilient`/`collector`/`alchemist` sopra: aggettivi in -e (stessa forma per m/f in
 * italiano, incluso "duellante" stesso), frasi descrittive senza accordo di genere sulla persona
 * ("La muraglia", "In difesa"/"In guardia" — epiteti, non descrivono grammaticalmente CHI li porta),
 * o composti bahuvrihi già invariabili di loro (`shieldbreaker`, "Spezzadifese", come
 * "un/una guastafeste").
 */
export const GENDERED_TITLE_IDS: ReadonlySet<string> = new Set<string>([
  'novice',
  'stubborn',
  'gatherer',
  'enchanter',
  'magical',
  'dangerous',
  'sorcerer',
  'first_duelist',
  'attentive',
  'educated',
  'buddy',
  'destroyer',
  'shadowbound',
  'radiant',
]);

/** Gli id concreti da aggiungere a `unlockedTitles` per il reward titolo di un obiettivo (o per un
 * titolo gratuito, v. TITLE_CATALOG sotto) — uno solo per i titoli invarianti, tre (`_m`/`_f`/`_x`)
 * per quelli in `GENDERED_TITLE_IDS`. */
export function titleRewardVariantIds(baseId: string): string[] {
  return GENDERED_TITLE_IDS.has(baseId) ? [`${baseId}_m`, `${baseId}_f`, `${baseId}_x`] : [baseId];
}

/** L'id BASE di un titolo equipaggiato (`UserProfile.title`, una delle variant-id sopra) — inverso
 * di `titleRewardVariantIds`. Serve a risalire alla definizione in `TITLE_CATALOG` (es. per il
 * flag `private`, v. ProfileComponent) a partire dalla variante concreta scelta dall'utente. */
export function titleBaseId(variantId: string): string {
  for (const base of GENDERED_TITLE_IDS) {
    if (variantId === `${base}_m` || variantId === `${base}_f` || variantId === `${base}_x`)
      return base;
  }
  return variantId;
}

export interface TitleDefinition {
  id: string;
  unlock: RewardUnlock;
}

/** Uid dell'unico account per cui `unlock.kind === 'exclusive'` può risolvere in TITLE_CATALOG —
 * v. "first_duelist" ("Primo duellante") sotto. Stesso valore di `AuthService.DEBUG_UID` (non un
 * caso: è l'account personale dello sviluppatore) ma duplicato invece di importato — data/*.ts non
 * dipende da services/*.ts altrove nel progetto, e importarlo da qui creerebbe un ciclo
 * (auth.service.ts già importa titleRewardVariantIds da questo file). Deve combaciare con
 * `exclusiveTitleOwnerUid()` in firestore.rules (le regole non possono importare questo modulo, è
 * un mirror manuale). */
export const EXCLUSIVE_TITLE_OWNER_UID = '8AkU1Du8BlNQYDKzH8Icu7lf8Qt2';

/**
 * Catalogo completo dei titoli — mirror di CARD_BACK_CATALOG/BACKGROUND_CATALOG: a differenza di
 * prima (quando "nessun titolo è mai gratuito" era un'assunzione fissa, v. UserProfile.title),
 * alcuni titoli sono ora `free` fin da subito. I titoli legati a un obiettivo (`kind: 'objective'`)
 * restano derivati anche da OBJECTIVE_CATALOG (stesso doppio riferimento già presente per
 * dorsi/sfondi: qui cosa mostrare in Collezione, là quale reward accreditare al riscatto).
 *
 * `first_duelist` ("Primo duellante"/"Prima duellante") è `exclusive` a `EXCLUSIVE_TITLE_OWNER_UID`
 * — non un titolo gratuito per chiunque: nessun altro account può ottenerlo o equipaggiarlo (v.
 * firestore.rules, exclusiveTitles()), e CollectionComponent lo esclude interamente dalla griglia
 * per chiunque non sia quell'uid (non "bloccato e visibile", proprio assente — a differenza di ogni
 * altro titolo, che mostra sempre lo slot anche se non ancora sbloccato). Resta comunque visibile
 * normalmente ovunque un titolo equipaggiato si mostri (profilo pubblico, in game): l'esclusività
 * riguarda solo chi può OTTENERLO, non chi può VEDERLO una volta equipaggiato.
 */
export const TITLE_CATALOG: TitleDefinition[] = [
  { id: 'beginner', unlock: { kind: 'free' } },
  { id: 'first_duelist', unlock: { kind: 'exclusive', uid: EXCLUSIVE_TITLE_OWNER_UID } },
  { id: 'novice', unlock: { kind: 'objective', objectiveId: 'first_duel' } },
  { id: 'apprentice', unlock: { kind: 'objective', objectiveId: 'first_win' } },
  { id: 'stubborn', unlock: { kind: 'objective', objectiveId: 'lose_10' } },
  { id: 'unstoppable', unlock: { kind: 'objective', objectiveId: 'win_streak_5' } },
  { id: 'buddy', unlock: { kind: 'objective', objectiveId: 'friend_duel_1' } },
  { id: 'rival', unlock: { kind: 'objective', objectiveId: 'friend_duel_wins_5' } },
  { id: 'gatherer', unlock: { kind: 'objective', objectiveId: 'collect_100' } },
  { id: 'collector', unlock: { kind: 'objective', objectiveId: 'collect_500' } },
  { id: 'mixologist', unlock: { kind: 'objective', objectiveId: 'combine_10' } },
  { id: 'alchemist', unlock: { kind: 'objective', objectiveId: 'combine_50' } },
  { id: 'enchanter', unlock: { kind: 'objective', objectiveId: 'cast_10' } },
  { id: 'magical', unlock: { kind: 'objective', objectiveId: 'cast_50' } },
  { id: 'sorcerer', unlock: { kind: 'objective', objectiveId: 'cast_100' } },
  { id: 'hostile', unlock: { kind: 'objective', objectiveId: 'damage_50' } },
  { id: 'dangerous', unlock: { kind: 'objective', objectiveId: 'damage_100' } },
  { id: 'black_magic', unlock: { kind: 'objective', objectiveId: 'damage_500' } },
  { id: 'attentive', unlock: { kind: 'objective', objectiveId: 'heal_50' } },
  { id: 'resilient', unlock: { kind: 'objective', objectiveId: 'heal_100' } },
  { id: 'white_magic', unlock: { kind: 'objective', objectiveId: 'heal_500' } },
  { id: 'defensive', unlock: { kind: 'objective', objectiveId: 'shield_gain_10' } },
  { id: 'on_guard', unlock: { kind: 'objective', objectiveId: 'shield_gain_50' } },
  { id: 'the_wall', unlock: { kind: 'objective', objectiveId: 'shield_gain_100' } },
  { id: 'shieldbreaker', unlock: { kind: 'objective', objectiveId: 'shield_remove_10' } },
  { id: 'destroyer', unlock: { kind: 'objective', objectiveId: 'shield_remove_50' } },
  { id: 'educated', unlock: { kind: 'objective', objectiveId: 'rulebook_read' } },
  { id: 'omnipresent', unlock: { kind: 'objective', objectiveId: 'login_streak_7' } },
  { id: 'sociable_duelist', unlock: { kind: 'objective', objectiveId: 'friends_1' } },
  { id: 'friendly_duelist', unlock: { kind: 'objective', objectiveId: 'friends_5' } },
  { id: 'shadowbound', unlock: { kind: 'objective', objectiveId: 'combine_dark_5' } },
  { id: 'radiant', unlock: { kind: 'objective', objectiveId: 'combine_light_5' } },
];

/** Variant-id EQUIPAGGIABILI senza passare da un riscatto obiettivo, PER UN utente specifico —
 * l'unione dei titoli gratuiti per chiunque (`unlock.kind === 'free'`) e dei titoli esclusivi il
 * cui uid combacia con `uid` (v. TITLE_CATALOG sopra). Usato sia da CollectionComponent
 * ("Imposta personalizzazioni") sia — come mirror manuale, le regole non possono importare questo
 * modulo — da freeTitles()/exclusiveTitles() in firestore.rules. */
export function freeTitleVariantIdsFor(uid: string | undefined): string[] {
  return TITLE_CATALOG.filter(
    (def) =>
      def.unlock.kind === 'free' || (def.unlock.kind === 'exclusive' && def.unlock.uid === uid),
  ).flatMap((def) => titleRewardVariantIds(def.id));
}
