import type { CollectibleElement } from '../models/element.model';

/**
 * I veri elementi di gioco mostrabili nella sezione "Elementi" di Collezione — tutti i
 * `CollectibleElement` (v. element.model.ts, = Element tranne 'mana'): 4 base + 4 avanzati + 2
 * superiori + Residuo Arcano = 11. A differenza di dorsi/sfondi/titoli, qui l'arte NUOVA è già
 * sempre posseduta (è quella in uso in ogni partita) — quello che si sblocca è l'arte v1 originale
 * accanto (v. CollectionComponent.elementItems), non l'elemento in sé.
 */
export const COLLECTIBLE_ELEMENT_IDS: readonly CollectibleElement[] = [
  'fire',
  'water',
  'air',
  'earth',
  'thunder',
  'poison',
  'ice',
  'lava',
  'light',
  'dark',
  'residium',
];
