import type { Element } from './element.model';

export type CardTier = 'base' | 'advanced' | 'superior' | 'residium';

export interface Card {
  id: string;
  tier: CardTier;
  element: Element;
}
