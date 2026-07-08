import type { Card } from '../models/card.model';
import type { BaseElement, Element } from '../models/element.model';
import { SUPERIOR_FORMULA } from '../models/element.model';
import type { ExplosionEvent, GameState } from '../models/game.model';
import type { PendingSpell, PlayerId, PlayerState } from '../models/player.model';
import { computePlayerMana } from '../models/player.model';
import type { SpellEffect } from '../models/spell.model';
import { TURN_PHASES, type ActiveTurnPhase } from '../models/turn-phase.model';
import { SPELL_CATALOG } from '../data/spells';
import { drawUpTo, HAND_SIZE } from './deck-builder';

function updatePlayer(state: GameState, role: PlayerId, patch: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [role]: { ...state.players[role], ...patch },
    },
  };
}

/** Il controllo sul tier evita che una carta non-base che riusa un elemento base solo per la propria arte (es. una carta incantesimo, vedi Card.spellId) venga scambiata per la base vera in una combinazione. */
function removeOneByElement(cards: readonly Card[], element: BaseElement): { removed: Card | null; rest: Card[] } {
  const rest = [...cards];
  const index = rest.findIndex(c => c.element === element && c.tier === 'base');
  if (index === -1) return { removed: null, rest };
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

/**
 * Come removeOneByElement, ma se l'elemento richiesto non è in mano ripiega su un Residuo Arcano
 * (2.5): "vale come un qualsiasi elemento base ai fini di qualsiasi combinazione". Usata da ogni
 * combinazione — avanzati, potenti, e la stessa combinazione che produce un Residuo — al posto della
 * sola removeOneByElement, così il jolly funziona ovunque uniformemente.
 */
function removeOneByElementOrResidue(cards: readonly Card[], element: BaseElement): { removed: Card | null; rest: Card[] } {
  const exact = removeOneByElement(cards, element);
  if (exact.removed) return exact;

  const rest = [...cards];
  const index = rest.findIndex(c => c.tier === 'residium');
  if (index === -1) return { removed: null, rest: [...cards] };
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

/** Filtra dalla mano le carte "temporanee" (Card.expiresAt) che scadono alla fase indicata — sciolte o consumate, mai scartate (regolamento 2.3.1, 2.5). */
function resolveExpiringCards(hand: readonly Card[], phase: ActiveTurnPhase): Card[] {
  return hand.filter(card => card.expiresAt !== phase);
}

/**
 * Bonus manico (regolamento 1.4.3): 10% di possibilità di +1 mana permanente su un elemento base
 * appena pescato dal mazzo comune; se il manico ha un elemento incastonato, la possibilità sale al
 * 20% ma vale solo per quell'elemento (nessun bonus generico al 10% per gli altri, in quel caso).
 */
function rollHandleBonus(card: Card, handleSocket: BaseElement | null): Card {
  const chance = handleSocket === null ? 0.1 : handleSocket === card.element ? 0.2 : 0;
  if (chance === 0 || Math.random() >= chance) return card;
  return { ...card, manaBonus: (card.manaBonus ?? 0) + 1 };
}

/**
 * Fase Raccolta (4.3), primo passo: pesca 2 carte dal mazzo comune (rimescolando i suoi scarti se
 * esaurito, regolamento 1.7) e le tiene in sospeso in attesa della scelta del giocatore — persistito,
 * non locale, così il mazzo non si disallinea tra il "peek" e la scelta effettiva. No-op se non sei
 * di turno, se hai già raccolto questo turno, o se non ci sono abbastanza carte nemmeno dopo il
 * rimescolamento (caso limite).
 */
export function startCollect(state: GameState, role: PlayerId): GameState {
  if (role !== state.currentTurn) return state;
  const player = state.players[role];
  if (player.hasCollectedThisTurn || player.pendingCollect) return state;

  const { drawn, deck, discards } = drawUpTo(state.commonDeck, state.commonDiscards, 2);
  if (drawn.length < 2) return state;

  const handleSocket = player.wand.handleSocket;
  const pending: [Card, Card] = [
    rollHandleBonus(drawn[0], handleSocket),
    rollHandleBonus(drawn[1], handleSocket),
  ];

  const withDeck: GameState = { ...state, commonDeck: deck, commonDiscards: discards };
  return updatePlayer(withDeck, role, { pendingCollect: pending });
}

/**
 * Fase Raccolta (4.3), secondo passo: tieni una delle 2 carte in sospeso, l'altra torna negli scarti
 * comuni. La carta tenuta va negli scarti del proprio mazzo — non in mano. No-op se non sei di turno
 * o se non c'è una raccolta in sospeso.
 */
export function keepCard(state: GameState, role: PlayerId, keptId: string): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const pending = player.pendingCollect;
  if (!pending) return state;

  const [first, second] = pending;
  const kept = first.id === keptId ? first : second.id === keptId ? second : null;
  if (!kept) return state;
  const rejected = kept === first ? second : first;

  const withDiscards: GameState = { ...state, commonDiscards: [...state.commonDiscards, rejected] };
  return updatePlayer(withDiscards, role, {
    discards: [...player.discards, kept],
    pendingCollect: null,
    hasCollectedThisTurn: true,
  });
}

/** Mana vitale/caotico (3.2.2/3.2.3): PS extra restituiti al lanciatore, o danni extra inflitti all'avversario, per ogni carta di quel tipo spesa in pagamento — calcolati qui (non in resolveSpells) perché le carte di pagamento vengono scartate subito e non sarebbero più consultabili al momento della risoluzione. Si applicano solo se la magia include un effetto rispettivamente 'heal'/'damage' (vedi applySpellEffect) — altrimenti restano inerti, la carta vale come un mana comune. */
const SPECIAL_MANA_EFFECT_AMOUNT = 2;

/**
 * Fase Azione (5.2): lancia una carta incantesimo dalla mano, pagandone subito il costo in mana
 * scartando le carte indicate. L'effetto NON si applica qui — resta in sospeso in pendingSpells fino
 * al passaggio in fase Incantesimo (vedi resolveSpells, agganciata in advanceTurnPhase), come da
 * regolamento 4.4/4.5. No-op se: non sei di turno, non sei in Azione, la carta non è un incantesimo
 * valido, o le carte di pagamento indicate non coprono il costo (tier 'spell'/'freeze' esclusi dal
 * pagamento: non sono elementi, 3.1).
 */
export function castSpell(state: GameState, role: PlayerId, spellCardId: string, paidCardIds: readonly string[]): GameState {
  if (role !== state.currentTurn || state.phase !== 'azione') return state;

  const player = state.players[role];
  const spellCard = player.hand.find(c => c.id === spellCardId && c.tier === 'spell');
  if (!spellCard?.spellId) return state;

  const spell = SPELL_CATALOG.find(s => s.id === spellCard.spellId);
  if (!spell) return state;

  const paidCards = paidCardIds.map(id => player.hand.find(c => c.id === id)).filter((c): c is Card => !!c);
  if (paidCards.length !== paidCardIds.length) return state;
  if (paidCards.some(c => c.tier === 'spell' || c.tier === 'freeze')) return state;
  if (computePlayerMana(paidCards) < spell.manaCost) return state;

  const vitalBonus = paidCards.filter(c => c.specialMana === 'vital').length * SPECIAL_MANA_EFFECT_AMOUNT;
  const chaoticBonus = paidCards.filter(c => c.specialMana === 'chaotic').length * SPECIAL_MANA_EFFECT_AMOUNT;

  const spentIds = new Set([spellCardId, ...paidCardIds]);
  return updatePlayer(state, role, {
    hand: player.hand.filter(c => !spentIds.has(c.id)),
    discards: [...player.discards, ...paidCards],
    pendingSpells: [...player.pendingSpells, { card: spellCard, vitalBonus, chaoticBonus }],
    spellsPlayedThisTurn: player.spellsPlayedThisTurn + 1,
  });
}

/**
 * Prende la carta rivelata nello slot indicato della Fonte Arcana e rimpiazza subito lo slot dal
 * mazzo avanzato (rimescolando i suoi scarti se esaurito, caso limite: se anche quelli sono
 * esauriti lo slot preso non si rimpiazza — la Fonte Arcana mostra una carta in meno finché
 * qualcosa non torna negli scarti). Condivisa da combineElements e combineSuperior, che differiscono
 * solo su quali/quante basi consumano dalla mano.
 */
function takeFromFonte(state: GameState, fonteSlotIndex: number): { state: GameState; obtained: Card } | null {
  const obtained = state.fonteElementale[fonteSlotIndex];
  if (!obtained) return null;

  const { drawn, deck: advancedDeck, discards: advancedDiscards } = drawUpTo(state.advancedDeck, state.advancedDiscards, 1);
  const replacement = drawn[0] ?? null;

  const fonteElementale = [...state.fonteElementale];
  if (replacement) {
    fonteElementale[fonteSlotIndex] = replacement;
  } else {
    fonteElementale.splice(fonteSlotIndex, 1);
  }

  return { state: { ...state, fonteElementale, advancedDeck, advancedDiscards }, obtained };
}

/**
 * Fase Azione (2.3/2.6): combina 2 elementi base dalla mano (o un Residuo Arcano al loro posto,
 * 2.5) per ottenere la carta rivelata nello slot indicato della Fonte Arcana. Le basi vere vengono
 * consumate negli scarti del mazzo comune; un eventuale Residuo usato come jolly si consuma invece
 * per sempre (non ha una propria pila scarti). La carta ottenuta va negli scarti del giocatore.
 * No-op se non sei di turno o se la mano non contiene gli elementi richiesti (basi o Residuo).
 */
export function combineElements(
  state: GameState,
  role: PlayerId,
  fonteSlotIndex: number,
  a: BaseElement,
  b: BaseElement,
): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const { removed: cardA, rest: handAfterA } = removeOneByElementOrResidue(player.hand, a);
  if (!cardA) return state;
  const { removed: cardB, rest: handAfterB } = removeOneByElementOrResidue(handAfterA, b);
  if (!cardB) return state;

  const taken = takeFromFonte(state, fonteSlotIndex);
  if (!taken) return state;

  const consumedBases = [cardA, cardB].filter(c => c.tier !== 'residium');
  const withTable: GameState = { ...taken.state, commonDiscards: [...taken.state.commonDiscards, ...consumedBases] };
  const withHand = updatePlayer(withTable, role, { hand: handAfterB, discards: [...player.discards, taken.obtained] });

  // Esplosione elementale (2.4): il nuovo slot rivelato in Fonte Arcana da takeFromFonte potrebbe
  // essere Luce o Tenebra (la carta ottenuta qui è sempre un avanzato, mai un potente).
  return resolveElementalExplosions(withHand);
}

/**
 * Fase Azione (2.4/2.6): combina i 4 elementi base della formula fissa (Fuoco+Acqua+Aria+Terra),
 * o Residui Arcani al loro posto (2.5), dalla mano per ottenere l'elemento potente rivelato nello
 * slot indicato della Fonte Arcana — stessa meccanica di combineElements, solo con 4 basi invece di
 * 2. No-op se non sei di turno o se la mano non contiene tutti e 4 gli elementi richiesti (basi o Residuo).
 */
export function combineSuperior(state: GameState, role: PlayerId, fonteSlotIndex: number): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  let hand = player.hand;
  const consumed: Card[] = [];
  for (const element of SUPERIOR_FORMULA) {
    const { removed, rest } = removeOneByElementOrResidue(hand, element);
    if (!removed) return state;
    consumed.push(removed);
    hand = rest;
  }

  const taken = takeFromFonte(state, fonteSlotIndex);
  if (!taken) return state;

  const consumedBases = consumed.filter(c => c.tier !== 'residium');
  const withTable: GameState = { ...taken.state, commonDiscards: [...taken.state.commonDiscards, ...consumedBases] };
  const withHand = updatePlayer(withTable, role, { hand, discards: [...player.discards, taken.obtained] });

  // Esplosione elementale (2.4): il nuovo slot rivelato in Fonte Arcana da takeFromFonte potrebbe
  // essere l'elemento potente opposto a quello appena ottenuto qui (che va negli scarti, non in mano).
  return resolveElementalExplosions(withHand);
}

/**
 * Fase Azione (2.5): combina 2 elementi base opposti dalla mano (Fuoco+Acqua o Aria+Terra — o un
 * Residuo al loro posto) per ottenere un Residuo Arcano dal pool condiviso di 8 copie sempre
 * scoperto (non un vero mazzo pescabile: qui semplicemente si toglie una copia dall'array). Va
 * negli scarti del giocatore, come la carta ottenuta da combineElements/combineSuperior — non
 * subito in mano: spendere 2 carte per ottenerne 1 sola d'immediato uso obbligato avrebbe spesso
 * sprecato l'azione (mano rimasta scarsa, nessuna vera occasione di comporre altro nello stesso
 * turno). Verrà ripescato più avanti insieme a una mano fresca da 5, con più probabilità di trovare
 * carte compatibili — l'urgenza "un turno per utilizzarlo" (Card.expiresAt 'fine', vedi
 * buildResiduumDeck) scatta da quel momento, non da quando viene creato. No-op se non sei di turno,
 * se la mano non contiene gli elementi richiesti, o se il pool è esaurito.
 */
export function combineResidue(state: GameState, role: PlayerId, a: BaseElement, b: BaseElement): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const { removed: cardA, rest: handAfterA } = removeOneByElementOrResidue(player.hand, a);
  if (!cardA) return state;
  const { removed: cardB, rest: handAfterB } = removeOneByElementOrResidue(handAfterA, b);
  if (!cardB) return state;

  const [obtained, ...residiumDeck] = state.residiumDeck;
  if (!obtained) return state;

  const consumedBases = [cardA, cardB].filter(c => c.tier !== 'residium');
  const withDeck: GameState = {
    ...state,
    residiumDeck,
    commonDiscards: [...state.commonDiscards, ...consumedBases],
  };
  return updatePlayer(withDeck, role, { hand: handAfterB, discards: [...player.discards, obtained] });
}

/**
 * Avanza la fase del giocatore di turno lungo il ciclo delle 6 fasi (sez. 4). 'attesa' non è mai una
 * fase persistita: è solo il valore mostrato all'avversario, calcolato lato UI. Da 'fine' passa
 * davvero il turno: scarta l'intera mano, pesca una mano fresca da 5, resetta i flag di turno.
 * No-op se non sei di turno.
 */
export function advanceTurnPhase(state: GameState, role: PlayerId): GameState {
  if (role !== state.currentTurn) return state;

  const playablePhases = TURN_PHASES.filter(p => p !== 'attesa');
  const currentIndex = playablePhases.indexOf(state.phase);
  const isLastPhase = currentIndex === playablePhases.length - 1;

  if (!isLastPhase) {
    const nextPhase = playablePhases[currentIndex + 1];
    const advanced: GameState = { ...state, phase: nextPhase };
    // Fase Incantesimo (4.5): le magie lanciate in Azione (pendingSpells) si risolvono qui, subito —
    // stesso schema di endTurn con Preparazione: chi osserva lo stato la vede già risolta.
    return nextPhase === 'incantesimo' ? resolveSpells(advanced, role) : advanced;
  }

  return endTurn(state, role);
}

function endTurn(state: GameState, role: PlayerId): GameState {
  const player = state.players[role];
  const otherRole: PlayerId = role === 'host' ? 'guest' : 'host';

  // Fase Finale (4.6): un Residuo Arcano ancora in mano a questo punto si consuma per sempre (2.5,
  // Card.expiresAt 'fine') — va escluso PRIMA dello scarto della mano, altrimenti finirebbe negli
  // scarti del giocatore come una carta qualunque, cosa che "consumarsi" non è.
  const handAfterExpiry = resolveExpiringCards(player.hand, 'fine');

  // Tutte le carte non utilizzate in mano si scartano (vanno negli scarti del proprio mazzo)
  // prima di pescare la mano fresca — se il mazzo si esaurisce, drawUpTo rimescola questi stessi
  // scarti nel mazzo (regolamento 1.7), il che riduce di 1 il livello di avvelenamento (2.3.4/1.7).
  const { drawn, deck, discards, reshuffled } = drawUpTo(player.deck, [...player.discards, ...handAfterExpiry], HAND_SIZE);
  const poison = reshuffled ? Math.max(0, player.tokens.poison - 1) : player.tokens.poison;

  const stateAfterEnd = updatePlayer(state, role, {
    hand: drawn,
    deck,
    discards,
    tokens: { ...player.tokens, poison },
    hasCollectedThisTurn: false,
    hasUsedWandAbility: false,
    spellsPlayedThisTurn: 0,
  });

  const stateForNextTurn: GameState = {
    ...stateAfterEnd,
    currentTurn: otherRole,
    phase: 'preparazione',
    turnNumber: state.turnNumber + 1,
  };

  // Fase Preparazione (4.2): risolta subito per chi sta per iniziare il turno, non per chi lo ha
  // appena concluso — non richiede un passo separato, dato che l'unico modo di entrare in
  // 'preparazione' è proprio questo handoff di turno (o l'inizio partita, dove i due contatori sono
  // comunque a zero).
  const stateAfterPreparation = resolvePreparation(stateForNextTurn, otherRole);

  // Esplosione elementale (2.4): la mano appena pescata potrebbe contenere sia Luce che Tenebra.
  return resolveElementalExplosions(stateAfterPreparation);
}

/**
 * Fase Preparazione (4.2): 1 danno per ogni livello di Avvelenamento accumulato, e scioglimento
 * (rimozione dal gioco, non scarto) delle carte Congelamento eventualmente in mano (Card.expiresAt
 * 'preparazione', vedi applyFreeze).
 */
function resolvePreparation(state: GameState, target: PlayerId): GameState {
  const player = state.players[target];
  const poisonDamage = player.tokens.poison;
  const hand = resolveExpiringCards(player.hand, 'preparazione');

  return updatePlayer(state, target, { hp: player.hp - poisonDamage, hand });
}

/** Applica un singolo effetto di un incantesimo lanciato — solo 'damage'/'heal' per ora (v1 minima); gli altri ~16 SpellEffectType non hanno ancora una risoluzione (no-op). `bonus` è il mana speciale (3.2.2/3.2.3) calcolato al pagamento in castSpell: si somma solo all'effetto corrispondente (vitale→heal, caotico→damage), altrimenti resta inerte. Nessun clamp su hp: né qui né altrove nel motore esiste un pavimento a 0 o un tetto al massimo (la condizione di vittoria non è ancora implementata). */
function applySpellEffect(state: GameState, casterRole: PlayerId, effect: SpellEffect, bonus: Pick<PendingSpell, 'vitalBonus' | 'chaoticBonus'>): GameState {
  const opponentRole: PlayerId = casterRole === 'host' ? 'guest' : 'host';
  switch (effect.type) {
    case 'damage': {
      const opponent = state.players[opponentRole];
      return updatePlayer(state, opponentRole, { hp: opponent.hp - (effect.amount ?? 0) - bonus.chaoticBonus });
    }
    case 'heal': {
      const caster = state.players[casterRole];
      return updatePlayer(state, casterRole, { hp: caster.hp + (effect.amount ?? 0) + bonus.vitalBonus });
    }
    default:
      return state;
  }
}

/**
 * Fase Incantesimo (4.5/5.3): risolve le magie lanciate in Azione (pendingSpells) — applica gli
 * effetti di ciascuna (più l'eventuale bonus di mana speciale calcolato al pagamento, 3.2.2/3.2.3),
 * poi le sposta tutte negli scarti del lanciatore e svuota pendingSpells. Agganciata dentro
 * advanceTurnPhase, non da un endpoint separato.
 */
function resolveSpells(state: GameState, role: PlayerId): GameState {
  const player = state.players[role];
  if (player.pendingSpells.length === 0) return state;

  let next = state;
  for (const pending of player.pendingSpells) {
    const spell = SPELL_CATALOG.find(s => s.id === pending.card.spellId);
    if (!spell) continue;
    for (const effect of spell.effects) next = applySpellEffect(next, role, effect, pending);
  }

  const caster = next.players[role];
  return updatePlayer(next, role, {
    discards: [...caster.discards, ...player.pendingSpells.map(p => p.card)],
    pendingSpells: [],
  });
}

function extractOneByExactElement(cards: readonly Card[], element: Element): { removed: Card | null; rest: Card[] } {
  const rest = [...cards];
  const index = rest.findIndex(c => c.element === element);
  if (index === -1) return { removed: null, rest };
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

/**
 * Esplosione elementale (2.4): quando Luce e Tenebra si trovano nello stesso luogo — la mano di un
 * giocatore, o la Fonte Arcana — esplodono: 1 danno al bersaglio (solo al proprietario se in mano,
 * a entrambi i giocatori se nella Fonte Arcana) e le 2 carte si consumano. Per definizione di
 * "consumare" (2.4, nota su Consumare/Scartare): tornano negli scarti del mazzo comune a cui
 * appartengono, cioè il mazzo avanzato — non nella pila del proprietario (altrimenti, essendo mano
 * e mazzo personale dello stesso giocatore, rientrerebbero prima o poi nella sua stessa mano e
 * riesploderebbero all'infinito). In loop per il caso limite di più di 1 copia compresente. Va
 * richiamata dopo qualunque cambiamento che potrebbe aver introdotto un elemento potente in una
 * mano o in Fonte Arcana (inizio partita, endTurn, combineElements/combineSuperior).
 *
 * Ogni esplosione risolta qui è invisibile al client finché non arriva il nuovo stato (si è già
 * consumata, proprio come lo scioglimento del Congelamento) — `lastExplosions`/`explosionBatchId`
 * esistono solo per permettere al client di accorgersene e giocare un'animazione, non sono un log
 * storico: se non succede nulla restano quelli di sempre, invariati.
 */
export function resolveElementalExplosions(state: GameState): GameState {
  let next = state;
  const events: ExplosionEvent[] = [];

  for (const role of ['host', 'guest'] as const) {
    let player = next.players[role];
    while (player.hand.some(c => c.element === 'light') && player.hand.some(c => c.element === 'dark')) {
      const { removed: light, rest: afterLight } = extractOneByExactElement(player.hand, 'light');
      const { removed: dark, rest: hand } = extractOneByExactElement(afterLight, 'dark');
      next = updatePlayer(next, role, { hand, hp: player.hp - 1 });
      next = { ...next, advancedDiscards: [...next.advancedDiscards, light!, dark!] };
      player = next.players[role];
      events.push({ location: 'hand', affectedRoles: [role], cards: [light!, dark!] });
    }
  }

  while (next.fonteElementale.some(c => c.element === 'light') && next.fonteElementale.some(c => c.element === 'dark')) {
    const { removed: light, rest: afterLight } = extractOneByExactElement(next.fonteElementale, 'light');
    const { removed: dark, rest: afterDark } = extractOneByExactElement(afterLight, 'dark');

    // 2.6: i 2 slot appena esplosi si rimpiazzano subito con 2 nuove carte pescate dal mazzo
    // avanzato (stessa pescata di takeFromFonte) — restano vuoti solo nel caso limite in cui anche
    // gli scarti del mazzo avanzato (già aggiornati con light/dark appena consumate) siano esauriti.
    const { drawn: replacements, deck: advancedDeck, discards: advancedDiscards } =
      drawUpTo(next.advancedDeck, [...next.advancedDiscards, light!, dark!], 2);
    const fonteElementale = [...afterDark, ...replacements];

    next = {
      ...next,
      fonteElementale,
      advancedDeck,
      advancedDiscards,
      players: {
        host: { ...next.players.host, hp: next.players.host.hp - 1 },
        guest: { ...next.players.guest, hp: next.players.guest.hp - 1 },
      },
    };
    events.push({ location: 'fonte', affectedRoles: ['host', 'guest'], cards: [light!, dark!] });
  }

  if (events.length === 0) return next;
  return { ...next, lastExplosions: events, explosionBatchId: next.explosionBatchId + 1 };
}

const MAX_POISON = 3;

/**
 * Avvelenamento (2.3.4): incrementa il livello di veleno del bersaglio, cap a 3. Pensata per essere
 * chiamata dagli incantesimi che lo applicano — non ancora implementati, quindi al momento nessun
 * chiamante reale: il decadimento (endTurn) e la risoluzione (resolvePreparation) sopra sono già
 * testabili a prescindere, dato che agiscono sul livello accumulato in `PlayerTokens.poison`.
 */
export function applyPoison(state: GameState, target: PlayerId, amount: number): GameState {
  const player = state.players[target];
  const poison = Math.min(MAX_POISON, player.tokens.poison + amount);
  return updatePlayer(state, target, { tokens: { ...player.tokens, poison } });
}

/**
 * Congelamento (2.3.1): aggiunge `count` carte Congelamento (non-carte, tier 'freeze') agli scarti
 * del bersaglio — finiscono quindi nel suo mazzo alla prossima rimescolata. Pensata per essere
 * chiamata dagli incantesimi che lo applicano — non ancora implementati (vedi nota su applyPoison).
 */
export function applyFreeze(state: GameState, target: PlayerId, count: number): GameState {
  if (count <= 0) return state;
  const player = state.players[target];
  const freezeCards: Card[] = Array.from({ length: count }, () => ({
    id: `freeze-${crypto.randomUUID()}`,
    tier: 'freeze',
    element: 'ice',
    expiresAt: 'preparazione',
  }));
  return updatePlayer(state, target, { discards: [...player.discards, ...freezeCards] });
}
