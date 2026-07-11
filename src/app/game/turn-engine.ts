import type { Card, CardTier } from '../models/card.model';
import type { BaseElement, Element } from '../models/element.model';
import { SUPERIOR_FORMULA } from '../models/element.model';
import type { ExplosionEvent, GameState } from '../models/game.model';
import type { PendingSpell, PlayerId, PlayerState } from '../models/player.model';
import { computePlayerMana } from '../models/player.model';
import type { SpellEffect } from '../models/spell.model';
import { ELEMENT_OPPOSITES } from '../models/wand.model';
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
function removeOneByElement(
  cards: readonly Card[],
  element: BaseElement,
): { removed: Card | null; rest: Card[] } {
  const rest = [...cards];
  const index = rest.findIndex((c) => c.element === element && c.tier === 'base');
  if (index === -1) return { removed: null, rest };
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

/** Tier del pool a cui appartiene un elemento — usata da createSpell per capire in quale mazzo/tier cercare ciascun ingrediente della formula (2.1: base, avanzato, potente sono pool separati, mai intercambiabili tra loro). */
function elementTier(element: Element): CardTier {
  if (element === 'light' || element === 'dark') return 'superior';
  if (element === 'thunder' || element === 'poison' || element === 'ice' || element === 'lava')
    return 'advanced';
  return 'base';
}

/**
 * Come removeOneByElement, ma per un elemento avanzato o potente — corrispondenza esatta su elemento
 * E tier, senza il jolly Residuo Arcano: il Residuo "vale come un qualsiasi elemento base" (2.5),
 * niente più di quello, quindi non sostituisce mai un ingrediente avanzato/potente di una formula.
 * Usata solo da createSpell per gli ingredienti di formula che non sono elementi base — per quelli
 * resta removeFromHandOrTip (jolly + punta della bacchetta inclusi).
 */
function removeOneByElementExact(
  cards: readonly Card[],
  element: Element,
  tier: CardTier,
): { removed: Card | null; rest: Card[] } {
  const rest = [...cards];
  const index = rest.findIndex((c) => c.element === element && c.tier === tier);
  if (index === -1) return { removed: null, rest };
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

/**
 * Come removeOneByElement, ma se l'elemento richiesto non è in mano ripiega su un Residuo Arcano
 * (2.5): "vale come un qualsiasi elemento base ai fini di qualsiasi combinazione". Usata da ogni
 * combinazione — avanzati, potenti, e la stessa combinazione che produce un Residuo — al posto della
 * sola removeOneByElement, così il jolly funziona ovunque uniformemente. `chosenId`, quando presente,
 * forza quale copia specifica rimuovere — una base esatta O un Residuo, a scelta dell'utente
 * (CombineDialogComponent, quando c'era una scelta reale da fare, vedi combineNeedsChoice sotto) —
 * invece della preferenza automatica di sempre (base esatta prima, Residuo solo come ripiego). Se non
 * corrisponde a nessuna delle due, niente rimozione (nessun fallback silenzioso su un'altra carta).
 */
function removeOneByElementOrResidue(
  cards: readonly Card[],
  element: BaseElement,
  chosenId?: string,
): { removed: Card | null; rest: Card[] } {
  if (chosenId !== undefined) {
    const rest = [...cards];
    const index = rest.findIndex(
      (c) =>
        c.id === chosenId &&
        ((c.element === element && c.tier === 'base') || c.tier === 'residium'),
    );
    if (index === -1) return { removed: null, rest: [...cards] };
    const [removed] = rest.splice(index, 1);
    return { removed, rest };
  }

  const exact = removeOneByElement(cards, element);
  if (exact.removed) return exact;

  const rest = [...cards];
  const index = rest.findIndex((c) => c.tier === 'residium');
  if (index === -1) return { removed: null, rest: [...cards] };
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

/**
 * Come removeOneByElementOrResidue, ma considera anche la carta trattenuta nella punta della
 * bacchetta (1.4.1) come se fosse ancora in mano — costruisce il pool hand+tip, rimuove con la
 * stessa logica invariata, poi capisce (per id) se a essere rimossa è stata la carta della punta,
 * per svuotarla invece di toglierla da hand. Usata da tutte e 3 le combinazioni al posto della sola
 * removeOneByElementOrResidue, così la punta funziona ovunque uniformemente come un Residuo.
 */
function removeFromHandOrTip(
  hand: readonly Card[],
  tipSlot: Card | null,
  element: BaseElement,
  chosenId?: string,
): { removed: Card | null; hand: Card[]; tipSlot: Card | null } {
  const pool = tipSlot ? [...hand, tipSlot] : hand;
  const { removed } = removeOneByElementOrResidue(pool, element, chosenId);
  if (!removed) return { removed: null, hand: [...hand], tipSlot };
  if (tipSlot && removed.id === tipSlot.id) return { removed, hand: [...hand], tipSlot: null };
  // `rest` di removeOneByElementOrResidue è calcolato sul pool combinato (hand+tip) — se a essere
  // rimossa è una carta di hand, `rest` conterrebbe ancora la carta della punta in coda, duplicandola
  // nella mano finale. Si filtra da `hand` direttamente, non da quel `rest`.
  return { removed, hand: hand.filter((c) => c.id !== removed.id), tipSlot };
}

/**
 * true se per questo elemento c'è una scelta reale da fare tra più carte in mano: o più copie esatte
 * (tier 'base') e almeno una porta qualcosa di prezioso (bonus manico o mana speciale) — l'auto-scelta
 * (la prima trovata) rischierebbe di consumare quella "buona" al posto di una equivalente semplice —
 * oppure una base esatta E un Residuo Arcano ENTRAMBI disponibili: usare l'uno o l'altro non è mai
 * indifferente, dato che il Residuo è una risorsa scarsa (pool condiviso di 8 copie, nessuna pila
 * scarti — una volta speso non torna più) da proteggere quando possibile, anche se la base esatta è
 * del tutto semplice. Più copie di Residuo tra loro invece non generano mai una scelta (sono
 * intercambiabili, nessun bonus possibile su quel tier). Usata da board.component.ts per decidere se
 * serve aprire CombineDialogComponent prima di combinare.
 */
export function combineNeedsChoice(hand: readonly Card[], element: BaseElement): boolean {
  const exact = hand.filter((c) => c.element === element && c.tier === 'base');
  if (exact.length > 1 && exact.some((c) => (c.manaBonus ?? 0) > 0 || !!c.specialMana)) return true;
  return exact.length >= 1 && hand.some((c) => c.tier === 'residium');
}

/**
 * true se la mano contiene tutti gli elementi richiesti — per un elemento base, una base esatta o, in
 * sua assenza, un Residuo Arcano come jolly (2.5, stesso ordine di preferenza di
 * removeOneByElementOrResidue); per un elemento avanzato o potente, corrispondenza esatta su elemento
 * e tier, senza jolly (stessa distinzione di createSpell/removeOneByElementExact). Di sola verifica:
 * non rimuove nulla dalla mano vera, lavora su una copia locale. Usata sia per l'evidenziazione della
 * mano su Fonte Arcana/elementi potenti (board.component.ts, hasAllBaseCards — lì sempre elementi
 * base) sia per l'etichetta "creabile" nel Grimorio (5.1, GrimoireDialogComponent.creatable — lì
 * anche avanzati/potenti, per le formule che li richiedono) — il chiamante include già l'eventuale
 * carta nella punta della bacchetta (1.4.1) nell'array passato qui, se rilevante.
 */
export function hasElements(hand: readonly Card[], elements: readonly Element[]): boolean {
  const pool = [...hand];
  for (const el of elements) {
    const tier = elementTier(el);
    if (tier === 'base') {
      const exactIndex = pool.findIndex((c) => c.element === el && c.tier === 'base');
      if (exactIndex !== -1) {
        pool.splice(exactIndex, 1);
        continue;
      }
      const residueIndex = pool.findIndex((c) => c.tier === 'residium');
      if (residueIndex === -1) return false;
      pool.splice(residueIndex, 1);
      continue;
    }
    const exactIndex = pool.findIndex((c) => c.element === el && c.tier === tier);
    if (exactIndex === -1) return false;
    pool.splice(exactIndex, 1);
  }
  return true;
}

/** Filtra dalla mano le carte "temporanee" (Card.expiresAt) che scadono alla fase indicata — sciolte o consumate, mai scartate (regolamento 2.3.1, 2.5). */
function resolveExpiringCards(hand: readonly Card[], phase: ActiveTurnPhase): Card[] {
  return hand.filter((card) => card.expiresAt !== phase);
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

/**
 * Fase Raccolta (4.3), secondo passo — alternativa a keepCard: invece di tenere una delle 2 carte
 * pescate, le scarti ENTRAMBE negli scarti comuni (nessuna finisce nel tuo mazzo, a differenza di
 * keepCard) e ottieni al loro posto una carta "mana accumulato" (tier 'mana') direttamente in mano,
 * pronta da spendere questo stesso turno. Si consuma a fine turno se non usata (Card.expiresAt
 * 'fine', vedi resolveExpiringCards in endTurn) — non si può conservare da un turno all'altro. A
 * differenza di tenere una carta vera, questa scelta non fa crescere il proprio mazzo: né le 2 carte
 * scartate né la carta mana (che comunque svanisce, non si scarta) restano nel tuo ciclo di pesca.
 * No-op se non sei di turno o se non c'è una raccolta in sospeso.
 */
export function keepMana(state: GameState, role: PlayerId): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const pending = player.pendingCollect;
  if (!pending) return state;

  const manaCard: Card = {
    id: `mana-${crypto.randomUUID()}`,
    tier: 'mana',
    element: 'mana',
    expiresAt: 'fine',
  };

  const withDiscards: GameState = {
    ...state,
    commonDiscards: [...state.commonDiscards, ...pending],
  };
  return updatePlayer(withDiscards, role, {
    hand: [...player.hand, manaCard],
    pendingCollect: null,
    hasCollectedThisTurn: true,
  });
}

/**
 * Fase Azione (5.1): produce un incantesimo dal Grimorio spendendo gli elementi della sua formula
 * dalla mano. Ogni ingrediente cerca nel proprio pool di tier (elementTier) — un elemento base usa
 * removeFromHandOrTip come le combinazioni (Residuo Arcano come jolly, 2.5, e carta nella punta della
 * bacchetta incluse, 1.4.1, con la stessa scelta automatica di sempre — nessuna disambiguazione anche
 * quando la formula richiede più copie dello stesso elemento, es. Fuoco+Fuoco, dove
 * CombineDialogComponent non si applicherebbe comunque, la sua mappa di scelta è per elemento non per
 * singola carta); un elemento avanzato o potente usa removeOneByElementExact, corrispondenza esatta
 * su elemento e tier — niente jolly (il Residuo vale solo per i base) né punta (che accetta solo
 * carte tier 'base'). A differenza delle combinazioni, gli elementi spesi qui si SCARTANO (vanno
 * negli scarti del giocatore, non in quelli comuni) — per ora sempre così, senza ancora la scelta
 * "consuma uno o scarta tutti" prevista dal regolamento (5.1), rimandata. Il Residuo Arcano usato
 * come jolly si consuma comunque per sempre (2.5, nessuna pila scarti propria), come nelle
 * combinazioni. La carta incantesimo creata va anch'essa negli scarti del giocatore (5.1: "si
 * aggiunge alla pila degli scarti"), non in mano — verrà ripescata più avanti insieme a una mano
 * fresca, come le 2 magie iniziali già seminate nel mazzo di partenza (STARTER_SPELLS,
 * deck-builder.ts). No-op se non sei di turno, non sei in Azione, l'incantesimo non esiste, ha
 * formula vuota (starter_bolt/starter_balm: seminati nel mazzo iniziale, mai creabili) o non hai
 * tutti gli elementi richiesti.
 */
export function createSpell(state: GameState, role: PlayerId, spellId: string): GameState {
  if (role !== state.currentTurn || state.phase !== 'azione') return state;

  const spell = SPELL_CATALOG.find((s) => s.id === spellId);
  if (!spell || spell.formula.length === 0) return state;

  const player = state.players[role];
  let hand = player.hand;
  let tipSlot = player.wand.tipSlot;
  const consumed: Card[] = [];
  for (const element of spell.formula) {
    const tier = elementTier(element);
    if (tier === 'base') {
      // Elemento base: stessa removeFromHandOrTip delle combinazioni — jolly Residuo Arcano (2.5) e
      // carta nella punta della bacchetta (1.4.1) inclusi.
      const {
        removed,
        hand: nextHand,
        tipSlot: nextTip,
      } = removeFromHandOrTip(hand, tipSlot, element as BaseElement);
      if (!removed) return state;
      consumed.push(removed);
      hand = nextHand;
      tipSlot = nextTip;
    } else {
      // Elemento avanzato o potente: nessun jolly (il Residuo vale solo per i base) e mai nella
      // punta (holdAtTip accetta solo carte tier 'base', quindi non può contenerne uno).
      const { removed, rest } = removeOneByElementExact(hand, element, tier);
      if (!removed) return state;
      consumed.push(removed);
      hand = rest;
    }
  }

  const discardedCards = consumed.filter((c) => c.tier !== 'residium');
  const spellCard: Card = {
    id: `spell-${spellId}-${crypto.randomUUID()}`,
    tier: 'spell',
    element: spell.element ?? spell.formula[0],
    spellId,
  };

  return updatePlayer(state, role, {
    hand,
    wand: { ...player.wand, tipSlot },
    discards: [...player.discards, ...discardedCards, spellCard],
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
export function castSpell(
  state: GameState,
  role: PlayerId,
  spellCardId: string,
  paidCardIds: readonly string[],
): GameState {
  if (role !== state.currentTurn || state.phase !== 'azione') return state;

  const player = state.players[role];
  const spellCard = player.hand.find((c) => c.id === spellCardId && c.tier === 'spell');
  if (!spellCard?.spellId) return state;

  const spell = SPELL_CATALOG.find((s) => s.id === spellCard.spellId);
  if (!spell) return state;

  // La carta trattenuta nella punta della bacchetta (1.4.1) conta come se fosse ancora in mano —
  // anche come mana pagabile qui.
  const tipCard = player.wand.tipSlot;
  const payablePool = tipCard ? [...player.hand, tipCard] : player.hand;
  const paidCards = paidCardIds
    .map((id) => payablePool.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
  if (paidCards.length !== paidCardIds.length) return state;
  if (paidCards.some((c) => c.tier === 'spell' || c.tier === 'freeze')) return state;
  if (computePlayerMana(paidCards) < spell.manaCost) return state;

  const vitalBonus =
    paidCards.filter((c) => c.specialMana === 'vital').length * SPECIAL_MANA_EFFECT_AMOUNT;
  const chaoticBonus =
    paidCards.filter((c) => c.specialMana === 'chaotic').length * SPECIAL_MANA_EFFECT_AMOUNT;

  const spentIds = new Set([spellCardId, ...paidCardIds]);
  const tipWasSpent = !!tipCard && spentIds.has(tipCard.id);
  // Mana accumulato (1.4.3, tier 'mana'): svanisce sempre, usata o no (Card.expiresAt 'fine', vedi
  // keepMana) — non finisce mai negli scarti, altrimenti sarebbe ripescabile in futuro, cosa che
  // "svanire" non è. Stesso trattamento del Residuo Arcano in createSpell (discardedCards).
  const discardedPaidCards = paidCards.filter((c) => c.tier !== 'mana');
  return updatePlayer(state, role, {
    hand: player.hand.filter((c) => !spentIds.has(c.id)),
    discards: [...player.discards, ...discardedPaidCards],
    pendingSpells: [...player.pendingSpells, { card: spellCard, vitalBonus, chaoticBonus }],
    spellsPlayedThisTurn: player.spellsPlayedThisTurn + 1,
    wand: tipWasSpent ? { ...player.wand, tipSlot: null } : player.wand,
    tipCardPlacedTurn: tipWasSpent ? null : player.tipCardPlacedTurn,
  });
}

/**
 * Fase Azione (1.4.1/4.4): trattiene una carta base dalla mano nella punta della bacchetta —
 * disponibile come se fosse ancora in mano (vedi removeFromHandOrTip) durante il turno successivo
 * del giocatore, si consuma se non usata entro la fine di quello (vedi endTurn). No-op se non sei
 * di turno, non sei in Azione, la punta è già occupata, la carta non è in mano con tier 'base'
 * (niente Residuo: 1.4.1 dice letteralmente "un elemento base"), o la punta era già occupata
 * all'inizio di questo turno (PlayerState.tipHeldAtPreparation) — anche se quella carta è già stata
 * spesa in questa stessa fase Azione, il potere resta comunque non disponibile fino al prossimo
 * turno: altrimenti si potrebbe usare la carta trattenuta e trattenerne subito un'altra, di fatto
 * usando il potere ogni turno invece che a turni alterni.
 */
export function holdAtTip(state: GameState, role: PlayerId, cardId: string): GameState {
  if (role !== state.currentTurn || state.phase !== 'azione') return state;

  const player = state.players[role];
  if (player.wand.tipSlot || player.tipHeldAtPreparation) return state;

  const card = player.hand.find((c) => c.id === cardId && c.tier === 'base');
  if (!card) return state;

  return updatePlayer(state, role, {
    hand: player.hand.filter((c) => c.id !== cardId),
    wand: { ...player.wand, tipSlot: card },
    tipCardPlacedTurn: state.turnNumber,
  });
}

/**
 * Fase Azione (1.4.2/1.4.3/4.4): incastona una carta base dalla mano nell'asta o nel manico della
 * bacchetta — permanente per il resto della partita, mai sovrascrivibile una volta fatto (ogni
 * sezione ha un solo slot). La carta si consuma (va negli scarti del mazzo comune, non in quelli del
 * giocatore — stessa semantica già usata per la punta scaduta e le basi consumate in combinazione),
 * non è più utilizzabile per nient'altro. No-op se non sei di turno, non sei in Azione, la carta non
 * è in mano con tier 'base', o lo slot richiesto è già occupato. Non considera la carta nella punta
 * della bacchetta (1.4.1): il bottone "Incastona" compare solo sulle carte del ventaglio in mano.
 */
export function socketElement(
  state: GameState,
  role: PlayerId,
  cardId: string,
  target: 'body' | 'handle',
): GameState {
  if (role !== state.currentTurn || state.phase !== 'azione') return state;

  const player = state.players[role];
  const socketField = target === 'body' ? 'bodySocket' : 'handleSocket';
  if (player.wand[socketField]) return state;

  const card = player.hand.find((c) => c.id === cardId && c.tier === 'base');
  if (!card) return state;

  return {
    ...updatePlayer(state, role, {
      hand: player.hand.filter((c) => c.id !== cardId),
      wand: { ...player.wand, [socketField]: card.element },
    }),
    commonDiscards: [...state.commonDiscards, card],
  };
}

/**
 * Prende la carta rivelata nello slot indicato della Fonte Arcana e rimpiazza subito lo slot dal
 * mazzo avanzato (rimescolando i suoi scarti se esaurito, caso limite: se anche quelli sono
 * esauriti lo slot preso non si rimpiazza — la Fonte Arcana mostra una carta in meno finché
 * qualcosa non torna negli scarti). Condivisa da combineElements e combineSuperior, che differiscono
 * solo su quali/quante basi consumano dalla mano.
 */
function takeFromFonte(
  state: GameState,
  fonteSlotIndex: number,
): { state: GameState; obtained: Card } | null {
  const obtained = state.fonteElementale[fonteSlotIndex];
  if (!obtained) return null;

  const {
    drawn,
    deck: advancedDeck,
    discards: advancedDiscards,
  } = drawUpTo(state.advancedDeck, state.advancedDiscards, 1);
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
 * `chosenIds`, quando presente, forza quale copia specifica usare per l'elemento indicato — arriva da
 * CombineDialogComponent quando board.component.ts rileva un'ambiguità reale (hasValuableDuplicate),
 * altrimenti resta vuoto e si procede con la scelta automatica di sempre (la prima trovata).
 */
export function combineElements(
  state: GameState,
  role: PlayerId,
  fonteSlotIndex: number,
  a: BaseElement,
  b: BaseElement,
  chosenIds?: Partial<Record<BaseElement, string>>,
): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const {
    removed: cardA,
    hand: handAfterA,
    tipSlot: tipAfterA,
  } = removeFromHandOrTip(player.hand, player.wand.tipSlot, a, chosenIds?.[a]);
  if (!cardA) return state;
  const {
    removed: cardB,
    hand: handAfterB,
    tipSlot: tipAfterB,
  } = removeFromHandOrTip(handAfterA, tipAfterA, b, chosenIds?.[b]);
  if (!cardB) return state;

  const taken = takeFromFonte(state, fonteSlotIndex);
  if (!taken) return state;

  const consumedBases = [cardA, cardB].filter((c) => c.tier !== 'residium');
  const withTable: GameState = {
    ...taken.state,
    commonDiscards: [...taken.state.commonDiscards, ...consumedBases],
  };
  const withHand = updatePlayer(withTable, role, {
    hand: handAfterB,
    discards: [...player.discards, taken.obtained],
    wand: { ...player.wand, tipSlot: tipAfterB },
  });

  // Esplosione elementale (2.4): il nuovo slot rivelato in Fonte Arcana da takeFromFonte potrebbe
  // essere Luce o Tenebra (la carta ottenuta qui è sempre un avanzato, mai un potente).
  return resolveElementalExplosions(withHand);
}

/**
 * Fase Azione (2.4/2.6): combina i 4 elementi base della formula fissa (Fuoco+Acqua+Aria+Terra),
 * o Residui Arcani al loro posto (2.5), dalla mano per ottenere l'elemento potente rivelato nello
 * slot indicato della Fonte Arcana — stessa meccanica di combineElements, solo con 4 basi invece di
 * 2. No-op se non sei di turno o se la mano non contiene tutti e 4 gli elementi richiesti (basi o Residuo).
 * `chosenIds`: vedi combineElements sopra.
 */
export function combineSuperior(
  state: GameState,
  role: PlayerId,
  fonteSlotIndex: number,
  chosenIds?: Partial<Record<BaseElement, string>>,
): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  let hand = player.hand;
  let tipSlot = player.wand.tipSlot;
  const consumed: Card[] = [];
  for (const element of SUPERIOR_FORMULA) {
    const {
      removed,
      hand: nextHand,
      tipSlot: nextTip,
    } = removeFromHandOrTip(hand, tipSlot, element, chosenIds?.[element]);
    if (!removed) return state;
    consumed.push(removed);
    hand = nextHand;
    tipSlot = nextTip;
  }

  const taken = takeFromFonte(state, fonteSlotIndex);
  if (!taken) return state;

  const consumedBases = consumed.filter((c) => c.tier !== 'residium');
  const withTable: GameState = {
    ...taken.state,
    commonDiscards: [...taken.state.commonDiscards, ...consumedBases],
  };
  const withHand = updatePlayer(withTable, role, {
    hand,
    discards: [...player.discards, taken.obtained],
    wand: { ...player.wand, tipSlot },
  });

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
 * se la mano non contiene gli elementi richiesti, o se il pool è esaurito. `chosenIds`: vedi combineElements sopra.
 */
export function combineResidue(
  state: GameState,
  role: PlayerId,
  a: BaseElement,
  b: BaseElement,
  chosenIds?: Partial<Record<BaseElement, string>>,
): GameState {
  if (role !== state.currentTurn) return state;

  const player = state.players[role];
  const {
    removed: cardA,
    hand: handAfterA,
    tipSlot: tipAfterA,
  } = removeFromHandOrTip(player.hand, player.wand.tipSlot, a, chosenIds?.[a]);
  if (!cardA) return state;
  const {
    removed: cardB,
    hand: handAfterB,
    tipSlot: tipAfterB,
  } = removeFromHandOrTip(handAfterA, tipAfterA, b, chosenIds?.[b]);
  if (!cardB) return state;

  const [obtained, ...residiumDeck] = state.residiumDeck;
  if (!obtained) return state;

  const consumedBases = [cardA, cardB].filter((c) => c.tier !== 'residium');
  const withDeck: GameState = {
    ...state,
    residiumDeck,
    commonDiscards: [...state.commonDiscards, ...consumedBases],
  };
  return updatePlayer(withDeck, role, {
    hand: handAfterB,
    discards: [...player.discards, obtained],
    wand: { ...player.wand, tipSlot: tipAfterB },
  });
}

/**
 * Avanza la fase del giocatore di turno lungo il ciclo delle 6 fasi (sez. 4). 'attesa' non è mai una
 * fase persistita: è solo il valore mostrato all'avversario, calcolato lato UI. Da 'fine' passa
 * davvero il turno: scarta l'intera mano, pesca una mano fresca da 5, resetta i flag di turno.
 * No-op se non sei di turno.
 */
export function advanceTurnPhase(state: GameState, role: PlayerId): GameState {
  if (role !== state.currentTurn) return state;

  const playablePhases = TURN_PHASES.filter((p) => p !== 'attesa');
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

  // Punta della bacchetta (1.4.1): una carta trattenuta lì che non è stata messa in QUESTO stesso
  // turno (tipCardPlacedTurn !== state.turnNumber) ha già passato un confine di turno senza essere
  // usata — si consuma. Non si scarta: è una base, torna negli scarti del mazzo comune, non in
  // quelli del giocatore (definizione Consumare/Scartare, 2.4).
  const tipExpired = !!player.wand.tipSlot && player.tipCardPlacedTurn !== state.turnNumber;
  const wand = tipExpired ? { ...player.wand, tipSlot: null } : player.wand;
  const tipCardPlacedTurn = tipExpired ? null : player.tipCardPlacedTurn;
  const commonDiscardsAfterTip = tipExpired
    ? [...state.commonDiscards, player.wand.tipSlot!]
    : state.commonDiscards;

  // Fase Finale (4.6): un Residuo Arcano ancora in mano a questo punto si consuma per sempre (2.5,
  // Card.expiresAt 'fine') — va escluso PRIMA dello scarto della mano, altrimenti finirebbe negli
  // scarti del giocatore come una carta qualunque, cosa che "consumarsi" non è.
  const handAfterExpiry = resolveExpiringCards(player.hand, 'fine');

  // Tutte le carte non utilizzate in mano si scartano (vanno negli scarti del proprio mazzo)
  // prima di pescare la mano fresca — se il mazzo si esaurisce, drawUpTo rimescola questi stessi
  // scarti nel mazzo (regolamento 1.7), il che riduce di 1 il livello di avvelenamento (2.3.4/1.7).
  const { drawn, deck, discards, reshuffled } = drawUpTo(
    player.deck,
    [...player.discards, ...handAfterExpiry],
    HAND_SIZE,
  );
  const poison = reshuffled ? Math.max(0, player.tokens.poison - 1) : player.tokens.poison;

  const stateWithCommonDiscards: GameState = { ...state, commonDiscards: commonDiscardsAfterTip };
  const stateAfterEnd = updatePlayer(stateWithCommonDiscards, role, {
    hand: drawn,
    deck,
    discards,
    tokens: { ...player.tokens, poison },
    hasCollectedThisTurn: false,
    spellsPlayedThisTurn: 0,
    wand,
    tipCardPlacedTurn,
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
 * Fase Preparazione (4.2): 1 danno per ogni livello di Avvelenamento accumulato, scioglimento
 * (rimozione dal gioco, non scarto) delle carte Congelamento eventualmente in mano (Card.expiresAt
 * 'preparazione', vedi applyFreeze), e istantanea dello stato della punta della bacchetta
 * (PlayerState.tipHeldAtPreparation, 1.4.1) usata da holdAtTip per limitare il potere a turni
 * alterni.
 */
function resolvePreparation(state: GameState, target: PlayerId): GameState {
  const player = state.players[target];
  const poisonDamage = player.tokens.poison;
  const hand = resolveExpiringCards(player.hand, 'preparazione');

  return updatePlayer(state, target, {
    hp: player.hp - poisonDamage,
    hand,
    tipHeldAtPreparation: !!player.wand.tipSlot,
  });
}

/**
 * Asta della bacchetta (regolamento 1.4.2): modifica il danno subito in base all'elemento incastonato
 * dal bersaglio — Resistenza (-1) se coincide con l'elemento della magia, Vulnerabilità (+1) se
 * coincide con il suo opposto, invariato altrimenti (incluse le magie senza elemento, es.
 * starter_bolt, e un'asta ancora vuota — 1.4.2: "non ha alcuna abilità finché non vi viene
 * incastonato un elemento base"). Il danno non scende mai sotto 0 per via della sola Resistenza.
 * Si applica solo all'ammontare base dell'effetto, non al bonus di mana caotico (3.2.3, calcolato
 * separatamente in castSpell): quel bonus dipende dal tipo di carta usata per pagare, non
 * dall'elemento della magia.
 */
function applyBodyResistance(
  amount: number,
  spellElement: BaseElement | undefined,
  targetBodySocket: BaseElement | null,
): number {
  if (!spellElement || !targetBodySocket) return amount;
  if (spellElement === targetBodySocket) return Math.max(0, amount - 1);
  if (spellElement === ELEMENT_OPPOSITES[targetBodySocket]) return amount + 1;
  return amount;
}

/** Applica un singolo effetto di un incantesimo lanciato — 'damage'/'heal'/'poison_add'/'ice_add' per ora; gli altri ~13 SpellEffectType non hanno ancora una risoluzione (no-op). `bonus` è il mana speciale (3.2.2/3.2.3) calcolato al pagamento in castSpell: si somma solo all'effetto corrispondente (vitale→heal, caotico→damage), altrimenti resta inerte — 'poison_add'/'ice_add' non ne beneficiano (i loro effetti veri arrivano più avanti, in fase Preparazione, non qui). `spellElement` (Spell.element) alimenta la Resistenza/Vulnerabilità dell'asta (1.4.2, applyBodyResistance) sul solo effetto 'damage' — 'heal'/'poison_add'/'ice_add' non sono mai elementali (asta, Veleno e Congelamento restano meccaniche indipendenti). Nessun clamp su hp: né qui né altrove nel motore esiste un pavimento a 0 o un tetto al massimo (la condizione di vittoria non è ancora implementata). */
function applySpellEffect(
  state: GameState,
  casterRole: PlayerId,
  effect: SpellEffect,
  bonus: Pick<PendingSpell, 'vitalBonus' | 'chaoticBonus'>,
  spellElement: BaseElement | undefined,
): GameState {
  const opponentRole: PlayerId = casterRole === 'host' ? 'guest' : 'host';
  switch (effect.type) {
    case 'damage': {
      const opponent = state.players[opponentRole];
      const amount = applyBodyResistance(
        effect.amount ?? 0,
        spellElement,
        opponent.wand.bodySocket,
      );
      return updatePlayer(state, opponentRole, { hp: opponent.hp - amount - bonus.chaoticBonus });
    }
    case 'heal': {
      const caster = state.players[casterRole];
      return updatePlayer(state, casterRole, {
        hp: caster.hp + (effect.amount ?? 0) + bonus.vitalBonus,
      });
    }
    case 'poison_add':
      return applyPoison(state, opponentRole, effect.amount ?? 0);
    case 'ice_add':
      return applyFreeze(state, opponentRole, effect.amount ?? 0);
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
    const spell = SPELL_CATALOG.find((s) => s.id === pending.card.spellId);
    if (!spell) continue;
    for (const effect of spell.effects)
      next = applySpellEffect(next, role, effect, pending, spell.element);
  }

  const caster = next.players[role];
  return updatePlayer(next, role, {
    discards: [...caster.discards, ...player.pendingSpells.map((p) => p.card)],
    pendingSpells: [],
  });
}

function extractOneByExactElement(
  cards: readonly Card[],
  element: Element,
): { removed: Card | null; rest: Card[] } {
  const rest = [...cards];
  const index = rest.findIndex((c) => c.element === element);
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
    while (
      player.hand.some((c) => c.element === 'light') &&
      player.hand.some((c) => c.element === 'dark')
    ) {
      const { removed: light, rest: afterLight } = extractOneByExactElement(player.hand, 'light');
      const { removed: dark, rest: hand } = extractOneByExactElement(afterLight, 'dark');
      next = updatePlayer(next, role, { hand, hp: player.hp - 1 });
      next = { ...next, advancedDiscards: [...next.advancedDiscards, light!, dark!] };
      player = next.players[role];
      events.push({ location: 'hand', affectedRoles: [role], cards: [light!, dark!] });
    }
  }

  while (
    next.fonteElementale.some((c) => c.element === 'light') &&
    next.fonteElementale.some((c) => c.element === 'dark')
  ) {
    const { removed: light, rest: afterLight } = extractOneByExactElement(
      next.fonteElementale,
      'light',
    );
    const { removed: dark, rest: afterDark } = extractOneByExactElement(afterLight, 'dark');

    // 2.6: i 2 slot appena esplosi si rimpiazzano subito con 2 nuove carte pescate dal mazzo
    // avanzato (stessa pescata di takeFromFonte) — restano vuoti solo nel caso limite in cui anche
    // gli scarti del mazzo avanzato (già aggiornati con light/dark appena consumate) siano esauriti.
    const {
      drawn: replacements,
      deck: advancedDeck,
      discards: advancedDiscards,
    } = drawUpTo(next.advancedDeck, [...next.advancedDiscards, light!, dark!], 2);
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
 * Avvelenamento (2.3.4): incrementa il livello di veleno del bersaglio, cap a 3. Chiamata da
 * applySpellEffect per il tipo 'poison_add' — il decadimento (endTurn) e la risoluzione
 * (resolvePreparation) sopra restano indipendenti, agiscono comunque sul livello accumulato in
 * `PlayerTokens.poison`.
 */
export function applyPoison(state: GameState, target: PlayerId, amount: number): GameState {
  const player = state.players[target];
  const poison = Math.min(MAX_POISON, player.tokens.poison + amount);
  return updatePlayer(state, target, { tokens: { ...player.tokens, poison } });
}

/**
 * Congelamento (2.3.1): aggiunge `count` carte Congelamento (non-carte, tier 'freeze') agli scarti
 * del bersaglio — finiscono quindi nel suo mazzo alla prossima rimescolata. Chiamata da
 * applySpellEffect per il tipo 'ice_add' (frost/blizzard/ice_age in SPELL_CATALOG) — lo
 * scioglimento (fase Preparazione, Card.expiresAt 'preparazione') resta indipendente, agisce su
 * qualunque carta 'freeze' pescata in mano a prescindere da come sia stata generata.
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
