import type { Element } from './element.model';
import type { ActiveTurnPhase } from './turn-phase.model';

/** 'freeze' è una non-carta (regolamento 2.3.1): generata a runtime dal Congelamento, occupa spazio in mazzo/scarti/mano ma non ha valore di mana né entra in nessuna combinazione — si scioglie (sparisce) in fase Preparazione. 'spell' rappresenta un incantesimo lanciabile (regolamento 5.1-5.3): il suo `element` serve solo per l'arte/icona (vedi CardComponent), non per il mana né per le combinazioni alla Fonte Arcana. */
export type CardTier = 'base' | 'advanced' | 'superior' | 'residium' | 'freeze' | 'spell';

export interface Card {
  id: string;
  tier: CardTier;
  element: Element;
  /** Bonus manico (regolamento 1.4.3): permanente sulla carta stessa, non un effetto temporaneo del giocatore — così segue la carta anche se in futuro cambia proprietario (es. furto). Assente/0 se non ne ha mai ricevuto uno. */
  manaBonus?: number;
  /** Carta "temporanea" (regolamento 2.3.1 Congelamento, 2.5 Residuo Arcano): se ancora in mano quando si raggiunge questa fase, sparisce — sciolta o consumata a seconda del tipo, in nessun caso scartata. Assente per le carte normali, che non scadono mai. */
  expiresAt?: ActiveTurnPhase;
  /** Presente solo quando tier === 'spell' — riferimento a una voce di SPELL_CATALOG (src/app/data/spells.ts). */
  spellId?: string;
}
