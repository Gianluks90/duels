import type { Element } from './element.model';
import type { ActiveTurnPhase } from './turn-phase.model';

/** 'freeze' è una non-carta (regolamento 2.3.1): generata a runtime dal Congelamento, occupa spazio in mazzo/scarti/mano ma non ha valore di mana né entra in nessuna combinazione — si scioglie (sparisce) in fase Preparazione. 'spell' rappresenta un incantesimo lanciabile (regolamento 5.1-5.3): il suo `element` serve solo per l'arte/icona (vedi CardComponent), non per il mana né per le combinazioni alla Fonte Arcana. 'mana' è un'altra non-carta, generata a runtime in fase Raccolta (in alternativa a tenere una delle 2 carte pescate, vedi keepMana in turn-engine.ts): vale 1 mana spendibile subito ma mai in una combinazione (nessun helper di combinazione riconosce questo tier), e svanisce a fine turno anche se non speso (Card.expiresAt 'fine', come il Residuo Arcano) — non si può conservare da un turno all'altro. */
export type CardTier = 'base' | 'advanced' | 'superior' | 'residium' | 'freeze' | 'spell' | 'mana';

/** Mana speciale (regolamento 3.2): un modificatore legato alla carta stessa (non al giocatore che la pesca o la tiene in mano) — agisce sull'incantesimo pagato con quella carta. */
export type SpecialMana = 'prismatic' | 'vital' | 'chaotic';

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
  /** Mana speciale (regolamento 3.2): assente per la stragrande maggioranza delle carte base — solo 6 su 60 lo portano (2 copie ciascuno), assegnato una volta per tutte alla creazione del mazzo comune (vedi deck-builder.ts). */
  specialMana?: SpecialMana;
}

const SPECIAL_MANA_ICONS: Record<SpecialMana, string> = {
  prismatic: '/icons/diamond_shine_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg',
  vital: '/icons/favorite_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg',
  chaotic: '/icons/explosion_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg',
};

export function specialManaIconPath(type: SpecialMana): string {
  return SPECIAL_MANA_ICONS[type];
}
