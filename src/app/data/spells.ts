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
  // dello stesso elemento base), danno proporzionale. manaCost non segue necessariamente il valore
  // delle materie prime di formula — costo di creazione e costo di lancio restano deliberatamente
  // slegati, decisi caso per caso in base al danno inflitto piuttosto che ricavati dalla formula.
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
    manaCost: 5,
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
  // Anti-scudo (2.3.3, stesso ingrediente Lava dello Scudo sopra, in chiave offensiva stavolta) —
  // element assente per lo stesso motivo dei blocchi avanzati sopra. `amount` assente su 'breach'
  // ("annulla lo scudo dell'avversario", non un numero fisso) è intenzionale: applyShieldRemove in
  // turn-engine.ts tratta l'assenza di amount come "azzera tutto", stesso schema di ice_clear_self/
  // poison_clear_self.
  {
    id: 'fracture',
    formula: ['lava', 'fire'],
    manaCost: 3,
    effects: [{ type: 'shield_remove_opponent', amount: 2 }],
  },
  {
    id: 'breach',
    formula: ['lava', 'lava'],
    manaCost: 5,
    effects: [{ type: 'shield_remove_opponent' }],
  },
  // Tenebra pura, mana alto per un singolo effetto molto forte — element assente (Tenebra è
  // SuperiorElement, mai un BaseElement dell'asta 1.4.2, e comunque damage_halve_opponent non passa
  // per applyBodyResistance, vedi applySpellEffect).
  {
    id: 'black_hole',
    formula: ['dark', 'dark'],
    manaCost: 6,
    effects: [{ type: 'damage_halve_opponent' }],
  },
  // element assente: l'unico effetto è opponent_discard_random, mai un 'damage' — l'asta 1.4.2 non
  // ha nulla da fare qui anche se la formula è 3 Aria pura (a differenza di whirlwind/tornado sopra,
  // che invece infliggono danno e per questo portano element: 'air').
  {
    id: 'violent_gust',
    formula: ['air', 'air', 'air'],
    manaCost: 4,
    effects: [{ type: 'opponent_discard_random', amount: 1 }],
  },
  // fonte_reset: unico effetto che non tocca lo stato di un giocatore ma la Fonte Arcana condivisa
  // (applyFonteReset in turn-engine.ts) — element assente per lo stesso motivo di violent_gust sopra.
  {
    id: 'reset',
    formula: ['dark', 'air'],
    manaCost: 4,
    effects: [{ type: 'fonte_reset' }],
  },
  // element assente: l'unico effetto è opponent_discard_hand, mai un 'damage'.
  {
    id: 'low_blow',
    formula: ['dark', 'earth'],
    manaCost: 5,
    effects: [{ type: 'opponent_discard_hand' }],
  },
  // Occhio (5.x, Card.revealedToOpponent — persistente sulla carta, non un effetto a tempo): stesso
  // schema "amount assente = tutto" di breach/detox/heat sopra. element assente su entrambe: nessun
  // effetto 'damage' qui.
  {
    id: 'third_eye',
    formula: ['light', 'air'],
    manaCost: 3,
    effects: [{ type: 'reveal_opponent_hand', amount: 1 }],
  },
  {
    id: 'supreme_eye',
    formula: ['light', 'light'],
    manaCost: 6,
    effects: [{ type: 'reveal_opponent_hand' }],
  },
  // Rischio: formula = SUPERIOR_FORMULA (le stesse 4 basi di combineSuperior per Luce/Tenebra) — nessun
  // elemento portante unico, element assente. `amount` assente sull'effetto: il danno vero (3 per
  // coppia di elementi avanzati in Fonte Arcana, 0-6 con 4 slot) si calcola a risoluzione
  // (countAdvancedPairsInFonte in turn-engine.ts), non è un numero fisso nel catalogo. Mana basso
  // apposta: l'esito è spesso 0 (4 slot che mostrano 4 elementi diversi, o luce/tenebra che non
  // contano — vedi il commento sulla funzione), quindi va trattato come una scommessa economica, non
  // un danno affidabile.
  {
    id: 'risk',
    formula: ['fire', 'water', 'air', 'earth'],
    manaCost: 2,
    effects: [{ type: 'damage_from_fonte' }],
  },
  // Migliora mana: prima magia con una carta bersaglio scelta dal giocatore al lancio (5.x,
  // TARGET_CARD_EFFECT_TYPES in spell.model.ts) — element assente, l'effetto non è mai un 'damage'.
  // manaCost tenuto basso (2, non i 3 originariamente proposti) apposta: con mano da 5 carte, spell
  // card + pagamento consumano insieme fino a 3 carte già a 2 mana (se pagata con basi da 1 mana
  // l'una) — a 3 mana il pagamento da solo poteva arrivare a consumarne altrettante, lasciando 1 sola
  // carta rimasta in mano come bersaglio: una "scelta" a quel punto solo nominale, non reale.
  {
    id: 'improve_mana',
    formula: ['light', 'dark'],
    manaCost: 2,
    effects: [{ type: 'boost_card_mana', amount: 1 }],
  },
];
