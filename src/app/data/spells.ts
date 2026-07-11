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
  // Escalation delle 4 magie base sopra: stesse formule mono-elemento ma più cariche (3 o 4 copie
  // dello stesso elemento base), danno proporzionale. manaCost non segue il valore delle materie
  // prime di formula (es. drowning: 4 acqua da craftare, cioè 4 mana di ingredienti, ma costa solo
  // 3 mana da lanciare) — costo di creazione e costo di lancio restano deliberatamente slegati.
  {
    id: 'combustion',
    formula: ['fire', 'fire', 'fire'],
    manaCost: 3,
    effects: [{ type: 'damage', amount: 3 }],
    element: 'fire',
  },
  {
    id: 'inferno',
    formula: ['fire', 'fire', 'fire', 'fire'],
    manaCost: 5,
    effects: [{ type: 'damage', amount: 5 }],
    element: 'fire',
  },
  {
    id: 'flood',
    formula: ['water', 'water', 'water'],
    manaCost: 3,
    effects: [{ type: 'damage', amount: 3 }],
    element: 'water',
  },
  {
    id: 'drowning',
    formula: ['water', 'water', 'water', 'water'],
    manaCost: 3,
    effects: [{ type: 'damage', amount: 5 }],
    element: 'water',
  },
  {
    id: 'whirlwind',
    formula: ['air', 'air', 'air'],
    manaCost: 3,
    effects: [{ type: 'damage', amount: 3 }],
    element: 'air',
  },
  {
    id: 'tornado',
    formula: ['air', 'air', 'air', 'air'],
    manaCost: 5,
    effects: [{ type: 'damage', amount: 5 }],
    element: 'air',
  },
  {
    id: 'rockfall',
    formula: ['earth', 'earth', 'earth'],
    manaCost: 3,
    effects: [{ type: 'damage', amount: 3 }],
    element: 'earth',
  },
  {
    id: 'landslide',
    formula: ['earth', 'earth', 'earth', 'earth'],
    manaCost: 5,
    effects: [{ type: 'damage', amount: 5 }],
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
  // Scudo (2.3.3): formule con l'elemento avanzato Lava come ingrediente — stessa assenza di
  // Spell.element dei blocchi Veleno/Ghiaccio sopra. Target sempre il lanciatore stesso (applyShield
  // in turn-engine.ts, chiamata con casterRole, mai opponentRole).
  {
    id: 'protection',
    formula: ['lava', 'earth'],
    manaCost: 3,
    effects: [{ type: 'shield_add', amount: 2 }],
  },
  {
    id: 'wall',
    formula: ['lava', 'lava'],
    manaCost: 4,
    effects: [{ type: 'shield_add', amount: 3 }],
  },
  {
    id: 'aegis',
    formula: ['lava', 'lava', 'light'],
    manaCost: 5,
    effects: [{ type: 'shield_add', amount: 5 }],
  },
  // Tuono (2.3.2): stessa assenza di Spell.element dei blocchi sopra — nessun opposto per un
  // elemento avanzato sull'asta (1.4.2). damage_ignore_shields bypassa absorbWithShield in
  // applySpellEffect di proposito: pensato per bucare le difese (Scudo, blocco sopra).
  {
    id: 'lightning_bolt',
    formula: ['thunder', 'thunder'],
    manaCost: 4,
    effects: [{ type: 'damage_ignore_shields', amount: 3 }],
  },
  // damage_self (nessun element carrier proprio: la formula mescola Tenebra, potente, e Fuoco,
  // base — entrambi gli effetti danno usano comunque 'fire' come spellElement, dato che "danni
  // fuoco" vale sia per sé che per l'avversario secondo la formula dell'incantesimo).
  {
    id: 'black_flame',
    formula: ['dark', 'fire'],
    manaCost: 2,
    effects: [
      { type: 'damage_self', amount: 2 },
      { type: 'damage', amount: 4 },
    ],
    element: 'fire',
  },
  // "Cura di sé" da Veleno/Congelamento (2.3.1/2.3.4) — formule con Luce, entrambe assenti di
  // Spell.element per lo stesso motivo dei blocchi Veleno/Ghiaccio/Lava sopra (l'ingrediente
  // avanzato non ha un opposto sull'asta, 1.4.2).
  {
    id: 'heat',
    formula: ['light', 'ice'],
    manaCost: 3,
    effects: [{ type: 'ice_clear_self' }],
  },
  {
    id: 'detox',
    formula: ['light', 'poison'],
    manaCost: 3,
    effects: [{ type: 'poison_clear_self' }],
  },
];
