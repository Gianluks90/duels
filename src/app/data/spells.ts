import type { Spell } from '../models/spell.model';

export const SPELL_CATALOG: Spell[] = [
  {
    id: 'fire_bolt',
    formula: ['fire', 'fire'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    element: 'fire',
  },
  {
    id: 'water_lance',
    formula: ['water', 'water'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    element: 'water',
  },
  {
    id: 'air_slash',
    formula: ['air', 'air'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    element: 'air',
  },
  {
    id: 'earth_shard',
    formula: ['earth', 'earth'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    element: 'earth',
  },
  // formula: [] — non ottenibili dal flusso di creazione del grimorio (regolamento 5.1, non ancora
  // implementato): queste 2 sono seminate direttamente nel mazzo iniziale di ogni giocatore (vedi
  // deck-builder.ts), un'eccezione dichiarata alla regola "ogni incantesimo si crea".
  {
    id: 'starter_bolt',
    formula: [],
    manaCost: 3,
    effects: [{ type: 'damage', amount: 2 }],
  },
  {
    id: 'starter_balm',
    formula: [],
    manaCost: 3,
    effects: [{ type: 'heal', amount: 1 }],
  },
  // Veleno (2.3.4): formule con l'elemento avanzato Veleno come ingrediente — element assente su
  // tutte e 3 (Spell.element è tipizzato BaseElement, l'asta 1.4.2 non ha comunque un opposto
  // definito per gli elementi avanzati/potenti, quindi non ci sarebbe nulla da agganciare lì).
  {
    id: 'spore',
    formula: ['poison', 'earth'],
    manaCost: 3,
    effects: [{ type: 'poison_add', amount: 1 }],
  },
  {
    id: 'toxin',
    formula: ['poison', 'poison'],
    manaCost: 4,
    effects: [{ type: 'poison_add', amount: 2 }],
  },
  {
    id: 'pestilence',
    formula: ['poison', 'poison', 'dark'],
    manaCost: 5,
    effects: [{ type: 'poison_add', amount: 3 }],
  },
  // Congelamento (2.3.1): formule con l'elemento avanzato Ghiaccio come ingrediente — stessa
  // assenza di Spell.element delle formule a Veleno sopra (BaseElement non copre gli elementi
  // avanzati, e l'asta 1.4.2 non ha comunque un opposto definito per loro).
  {
    id: 'frost',
    formula: ['ice', 'water'],
    manaCost: 3,
    effects: [{ type: 'ice_add', amount: 1 }],
  },
  {
    id: 'blizzard',
    formula: ['ice', 'ice'],
    manaCost: 4,
    effects: [{ type: 'ice_add', amount: 2 }],
  },
  {
    id: 'ice_age',
    formula: ['ice', 'ice', 'dark'],
    manaCost: 5,
    effects: [{ type: 'ice_add', amount: 3 }],
  },
];
