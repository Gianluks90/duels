import { CARD_BACK_CATALOG } from '../data/card-backs';
import { BACKGROUND_CATALOG } from '../data/backgrounds';
import { TITLE_CATALOG, titleRewardVariantIds } from '../data/titles';
import { COLLECTIBLE_ELEMENT_IDS } from '../data/elements';
import { SPELL_CATALOG } from '../data/spells';
import type { UserProfile } from '../models/user.model';

/** Incantesimi lanciati per sbloccare l'arte v1 di un incantesimo — stessa soglia di
 * CollectionComponent (unico posto dove viene mostrata la griglia, qui serve solo per il conteggio
 * aggregato). */
export const SPELL_LEGACY_UNLOCK_COUNT = 10;

/** Stesse categorie/stesso ordine delle tab di CollectionComponent.categories — chiave stabile
 * usata sia per leggere il conteggio da CollectionProgress sia per l'etichetta i18n
 * (`collection.<key>`, le stesse stringhe già usate per le tab). */
export type CollectionCategoryKey =
  'cardBacks' | 'backgrounds' | 'titles' | 'elements' | 'mana' | 'spells';

export const COLLECTION_CATEGORY_ORDER: readonly CollectionCategoryKey[] = [
  'cardBacks',
  'backgrounds',
  'titles',
  'elements',
  'mana',
  'spells',
];

export interface CollectionCategoryProgress {
  owned: number;
  total: number;
}

export type CollectionProgress = Record<CollectionCategoryKey, CollectionCategoryProgress>;

/**
 * Owned/total per ciascuna categoria di Collezione, per un profilo qualunque — stessa formula
 * "owned/total su ogni slot mostrato in griglia" di CollectionComponent (cardBackItems/
 * backgroundItems/titleItems/elementItems/manaItems/spellItems), ma senza le dipendenze da
 * i18n/BackgroundService di quella pagina (lì servono per disegnare i tile, qui bastano i numeri).
 * Duplicato deliberatamente invece di condiviso con CollectionComponent: quella resta l'unica
 * sorgente della UI a griglia, questo è solo il riepilogo numerico per categoria riusato da
 * ProfileComponent (sezione "Collezione" del proprio profilo o di un amico).
 */
export function collectionProgress(profile: UserProfile | null | undefined): CollectionProgress {
  const progress: CollectionProgress = {
    cardBacks: { owned: 0, total: 0 },
    backgrounds: { owned: 0, total: 0 },
    titles: { owned: 0, total: 0 },
    elements: { owned: 0, total: 0 },
    mana: { owned: 0, total: 0 },
    spells: { owned: 0, total: 0 },
  };
  if (!profile) return progress;

  const ownedCardBacks = new Set(profile.unlockedCardBacks ?? []);
  for (const def of CARD_BACK_CATALOG) {
    progress.cardBacks.total++;
    if (def.unlock.kind === 'free' || ownedCardBacks.has(def.id)) progress.cardBacks.owned++;
  }

  const ownedBackgrounds = new Set(profile.unlockedBackgrounds ?? []);
  for (const def of BACKGROUND_CATALOG) {
    progress.backgrounds.total++;
    if (def.unlock.kind === 'free' || ownedBackgrounds.has(def.id)) progress.backgrounds.owned++;
  }

  const ownedTitles = new Set(profile.unlockedTitles ?? []);
  for (const def of TITLE_CATALOG) {
    // Un titolo `exclusive` di un altro uid non compare affatto nella griglia di QUEL profilo
    // (v. CollectionComponent.titleItems) — stesso filtro qui, sull'uid del profilo osservato.
    if (def.unlock.kind === 'exclusive' && def.unlock.uid !== profile.uid) continue;
    progress.titles.total++;
    if (
      def.unlock.kind === 'free' ||
      def.unlock.kind === 'exclusive' ||
      titleRewardVariantIds(def.id).some((variantId) => ownedTitles.has(variantId))
    ) {
      progress.titles.owned++;
    }
  }

  // Elementi + mana: l'arte corrente è sempre posseduta, quella v1 (legacy) segue
  // unlockedElementVariants — stesso schema di CollectionComponent.elementItems/manaItems, ma mana
  // è la sua categoria a parte (non un CollectibleElement, v. data/elements.ts).
  const ownedElementVariants = new Set(profile.unlockedElementVariants ?? []);
  for (const id of COLLECTIBLE_ELEMENT_IDS) {
    progress.elements.total += 2;
    progress.elements.owned += 1 + (ownedElementVariants.has(id) ? 1 : 0);
  }
  progress.mana.total = 2;
  progress.mana.owned = 1 + (ownedElementVariants.has('mana') ? 1 : 0);

  // Incantesimi: stesso schema, l'arte v1 segue il numero di lanci in spellCastCounts.
  const castCounts = profile.stats?.spellCastCounts ?? {};
  for (const spell of SPELL_CATALOG) {
    progress.spells.total += 2;
    progress.spells.owned += 1 + ((castCounts[spell.id] ?? 0) >= SPELL_LEGACY_UNLOCK_COUNT ? 1 : 0);
  }

  return progress;
}

/** % di completamento Collezione aggregata su tutte le categorie insieme — somma di
 * collectionProgress sopra, stessa idea di ObjectivesComponent.completionPercent applicata alla
 * Collezione invece che agli obiettivi. */
export function collectionCompletionPercent(profile: UserProfile | null | undefined): number {
  const progress = collectionProgress(profile);
  let total = 0;
  let owned = 0;
  for (const category of Object.values(progress)) {
    total += category.total;
    owned += category.owned;
  }
  return total === 0 ? 0 : Math.round((owned / total) * 100);
}
