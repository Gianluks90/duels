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
];
