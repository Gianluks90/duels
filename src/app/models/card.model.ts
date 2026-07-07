import type { Element } from './element.model';

/** 'freeze' è una non-carta (regolamento 2.3.1): generata a runtime dal Congelamento, occupa spazio in mazzo/scarti/mano ma non ha valore di mana né entra in nessuna combinazione — si scioglie (sparisce) in fase Preparazione. */
export type CardTier = 'base' | 'advanced' | 'superior' | 'residium' | 'freeze';

export interface Card {
  id: string;
  tier: CardTier;
  element: Element;
  /** Bonus manico (regolamento 1.4.3): permanente sulla carta stessa, non un effetto temporaneo del giocatore — così segue la carta anche se in futuro cambia proprietario (es. furto). Assente/0 se non ne ha mai ricevuto uno. */
  manaBonus?: number;
}
