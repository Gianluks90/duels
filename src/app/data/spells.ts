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
  // deck-builder.ts), un'eccezione dichiarata alla regola "ogni incantesimo si crea". amount
  // abbassato da 2 a 1 il 14/07/2026 (bilanciamento): a Difficoltà 0 e senza elemento (quindi mai
  // bersaglio di un bonus da vulnerabilità sull'asta, 1.4.2, a differenza di fire_bolt e affini),
  // dominava le 4 magie base mono-elemento a diff2/mana2 pur costando solo 1 mana in più — ora resta
  // un dardo affidabile ma strettamente più debole di qualunque magia craftata.
  {
    id: 'starter_bolt',
    formula: [],
    manaCost: 3,
    effects: [{ type: 'damage', amount: 1 }],
  },
  {
    id: 'starter_balm',
    formula: [],
    manaCost: 3,
    effects: [{ type: 'heal', amount: 1 }],
  },
  // Cura craftabile (aggiunta 14/07/2026, bilanciamento): fino ad ora 'heal' era usato solo da
  // starter_balm, mai craftabile — il mana vitale (3.2.2) non aveva quasi mai occasione di scattare.
  // Solo 2 livelli apposta (non una scala a 3 come mono-elemento/veleno/ghiaccio/scudo): troppa cura
  // craftabile rischia di far stagnare la partita. element assente su entrambe, nessun effetto
  // 'damage' qui.
  {
    id: 'mend',
    formula: ['water', 'air'],
    manaCost: 3,
    effects: [{ type: 'heal', amount: 2 }],
  },
  {
    id: 'radiant_heal',
    formula: ['light', 'water'],
    manaCost: 4,
    effects: [{ type: 'heal', amount: 3 }],
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
  // Lava, capacità "consumare" (2.3.3, elements.md: "alleggerire il mazzo") — prima magia con
  // MULTI_TARGET_CARD_EFFECT_TYPES (spell.model.ts): fino a 2 carte scelte dal giocatore nei
  // PROPRI scarti, mai obbligatorio (0 sempre valido, a differenza di boost_card_mana/improve_mana
  // sotto). Formula uguale a 'protection' sopra — non è un problema, il catalogo tollera già
  // formule ripetute (es. 'wall'/'fracture', entrambe ['lava','lava']): la selezione in Grimorio
  // avviene per spellId, non per matching automatico di formula. Costo un gradino sopra
  // 'protection' (stessa formula ma effetto di combattimento diretto): qui è utility/gestione
  // risorse su un massimo di 2 carte, non danno/scudo immediato.
  {
    id: 'dissolve',
    formula: ['lava', 'earth'],
    manaCost: 4,
    effects: [{ type: 'consume_discards', amount: 2 }],
  },
  // Versione più forte di 'dissolve' sopra: stesso effetto, stesso tetto (2 carte), ma pool
  // allargato con consumableCardTiers a incantesimi e carte effetto (oggi solo Congelamento — il
  // pool è già generico per tier, un domani un nuovo tier "effetto" ci rientrerebbe aggiungendolo
  // lì, senza toccare il motore). Incantesimi/Congelamento non hanno un mazzo comune/avanzato a cui
  // tornare: consumarli li fa sparire dal gioco (vedi applyConsumeDiscards in turn-engine.ts). Un
  // ingrediente Lava in più rispetto a 'dissolve' (Difficoltà 5 invece di 3, mana 5 invece di 4),
  // stesso passo di costo di wall→aegis.
  {
    id: 'destroy',
    formula: ['lava', 'lava', 'earth'],
    manaCost: 5,
    effects: [
      {
        type: 'consume_discards',
        amount: 2,
        consumableCardTiers: ['base', 'advanced', 'superior', 'spell', 'freeze'],
      },
    ],
  },
  {
    id: 'aegis',
    formula: ['lava', 'lava', 'light'],
    manaCost: 5,
    effects: [{ type: 'shield_add', amount: 5 }],
  },
  // Tuono (2.3.2): stessa assenza di Spell.element dei blocchi sopra — nessun opposto per un
  // elemento avanzato sull'asta (1.4.2). damage_ignore_shields bypassa absorbWithShield in
  // applySpellEffect di proposito: pensato per bucare le difese (Scudo, blocco sopra). Scala a 3
  // livelli completata il 14/07/2026 (bilanciamento) — stesso schema base+avanzato/avanzato+avanzato/
  // avanzato+avanzato+potente delle altre famiglie a elemento avanzato sopra (Veleno/Ghiaccio/Lava).
  {
    id: 'spark',
    formula: ['thunder', 'air'],
    manaCost: 3,
    effects: [{ type: 'damage_ignore_shields', amount: 2 }],
  },
  {
    id: 'lightning_bolt',
    formula: ['thunder', 'thunder'],
    manaCost: 4,
    effects: [{ type: 'damage_ignore_shields', amount: 3 }],
  },
  {
    id: 'thunderstorm',
    formula: ['thunder', 'thunder', 'dark'],
    manaCost: 5,
    effects: [{ type: 'damage_ignore_shields', amount: 5 }],
  },
  // damage_self (nessun element carrier proprio: la formula mescola Tenebra, potente, e Fuoco,
  // base — entrambi gli effetti danno usano comunque 'fire' come spellElement, dato che "danni
  // fuoco" vale sia per sé che per l'avversario secondo la formula dell'incantesimo). Danno a sé
  // alzato da 2 a 4 il 14/07/2026 (bilanciamento): a parità di danno inflitto era di gran lunga
  // l'incantesimo più efficiente in mana del catalogo; pareggiato ora a un vero scambio 1:1, pensato
  // come mossa rischiosa di fine partita quando i PS dei due giocatori sono vicini.
  {
    id: 'black_flame',
    formula: ['dark', 'fire'],
    manaCost: 2,
    effects: [
      { type: 'damage_self', amount: 4 },
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
  // element assente per lo stesso motivo dei blocchi avanzati sopra. `amount` assente su 'fracture'
  // ("annulla lo scudo dell'avversario", non un numero fisso) è intenzionale: applyShieldRemove in
  // turn-engine.ts tratta l'assenza di amount come "azzera tutto", stesso schema di ice_clear_self/
  // poison_clear_self. Formula/effetti di 'fracture' e 'breach' invertiti il 17/07/2026 per far
  // combaciare meglio nome/illustrazione con l'effetto (Breccia = crepa parziale, Frattura = rottura
  // totale) — solo formula/manaCost/effects sono stati scambiati, gli id restano invariati.
  {
    id: 'breach',
    formula: ['lava', 'fire'],
    manaCost: 3,
    effects: [{ type: 'shield_remove_opponent', amount: 2 }],
  },
  {
    id: 'fracture',
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
  // Livello pesante di violent_gust sopra, aggiunto il 14/07/2026 (bilanciamento) — fermato a 2 carte
  // di proposito: con una mano da 5, 3 scarterebbe più della metà della mano in un colpo solo,
  // rischiando di far saltare il turno successivo del bersaglio quasi per intero. element assente,
  // stesso motivo di violent_gust sopra.
  {
    id: 'dark_gust',
    formula: ['air', 'dark'],
    manaCost: 4,
    effects: [{ type: 'opponent_discard_random', amount: 2 }],
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
  // Variante mirata di third_eye/supreme_eye sopra, aggiunta il 14/07/2026 (bilanciamento):
  // cardTierFilter: 'spell' (SpellEffect, spell.model.ts) restringe il pescaggio casuale alle sole
  // carte incantesimo in mano al bersaglio invece che a una carta qualunque — no-op se il bersaglio
  // non ne ha, stesso "rischio di whiff" del bersaglio negli scarti di improve_mana sotto. Stessa
  // fascia di costo/Difficoltà di third_eye (Luce+base, diff5/mana3): l'informazione è più mirata ma
  // non garantita, quindi non vale un salto di prezzo.
  {
    id: 'spell_glimpse',
    formula: ['light', 'fire'],
    manaCost: 3,
    effects: [{ type: 'reveal_opponent_hand', amount: 1, cardTierFilter: 'spell' }],
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
  // Bersaglio ridisegnato il 14/07/2026 (bilanciamento): non più una carta in mano (il costo basso
  // a mana2 era pensato per lasciare comunque un bersaglio libero in una mano da 5, ma restava
  // l'incantesimo più economico della sua fascia di Difficoltà) ma una carta nei PROPRI scarti — la
  // scelta resta un vero atto strategico (si potenzia una carta che tornerà comunque in gioco al
  // prossimo rimescolamento) e il costo può salire a mana5, in linea con gli altri incantesimi a
  // Difficoltà 8. Se gli scarti sono vuoti l'incantesimo si lancia comunque (mana pagato) ma non ha
  // alcun effetto — vedi castSpell/applyBoostCardMana in turn-engine.ts.
  {
    id: 'improve_mana',
    formula: ['light', 'dark'],
    manaCost: 5,
    effects: [{ type: 'boost_card_mana', amount: 1 }],
  },
];
