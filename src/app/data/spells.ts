import type { Spell } from '../models/spell.model';

export const SPELL_CATALOG: Spell[] = [
  {
    id: 'fire_bolt',
    name: 'Dardo di Fuoco',
    formula: ['fire', 'fire'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    flavorText: 'Evocare un Dardo di fuoco ti fa sentire proprio bene, senti il potere che fluisce dalle mani ed esplode ad una certa distanza. Emozionante!.',
  },
  {
    id: 'water_lance',
    name: "Lama d'Acqua",
    formula: ['water', 'water'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    flavorText: "Hai mai provato a lanciare un getto d'acqua ad una grande velocità? Ottieni lo stesso effetto di una sciabolata, ma più bagnato.",
  },
  {
    id: 'air_slash',
    name: "Raffica d'Aria",
    formula: ['air', 'air'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    flavorText: 'Non la sentirai nemmeno arrivare e quando ti colpirà, ti farà girare la testa e ti farà sentire come se fossi in un tornado.',
  },
  {
    id: 'earth_shard',
    name: 'Frammento di Terra',
    formula: ['earth', 'earth'],
    manaCost: 2,
    effects: [{ type: 'damage', amount: 1 }],
    flavorText: 'Un frammento di terra può sembrare innocuo, ma se lanciato con forza, può diventare un proiettile letale. La natura è potente e imprevedibile.',
  },
];
