import type { Card, CardTier } from '../models/card.model';
import type { BaseElement, Element } from '../models/element.model';
import { SUPERIOR_FORMULA } from '../models/element.model';
import type { ExplosionEvent, GameState } from '../models/game.model';
import type { DamageLogSource, GameLogEntryData } from '../models/game-log.model';
import type { PendingSpell, PlayerId, PlayerState } from '../models/player.model';
import { computePlayerMana } from '../models/player.model';
import type { SpellEffect } from '../models/spell.model';
import {
  TARGET_CARD_EFFECT_TYPES,
  MULTI_TARGET_CARD_EFFECT_TYPES,
  DEFAULT_CONSUMABLE_CARD_TIERS,
} from '../models/spell.model';
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

/** Voci del log eventi tenute in memoria — oltre questa soglia le più vecchie vengono scartate
 * (append-only altrimenti, mai un cap avrebbe fatto crescere il documento Firestore indefinitamente
 * su una partita molto lunga). */
const MAX_LOG_ENTRIES = 50;

/** Aggiunge una voce al log eventi (GameState.eventLog) — id assegnato qui (crypto.randomUUID(),
 * stesso schema delle carte generate a runtime come Congelamento), mai dal chiamante. Ogni reducer
 * che compie un'azione loggabile la aggiunge qui stesso, non un diff a valle: alcuni eventi (quale
 * combinazione è stata prodotta, quale incantesimo lanciato) non sarebbero comunque ricostruibili
 * da un semplice confronto prima/dopo dello stato. */
function appendLog(state: GameState, entry: GameLogEntryData): GameState {
  return {
    ...state,
    eventLog: [
      ...(state.eventLog ?? []),
      { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
    ].slice(-MAX_LOG_ENTRIES),
  };
}

/** Logga un `damage` solo se è stato davvero perso HP (amount > 0) — es. un danno interamente
 * assorbito dallo scudo non genera una voce, non c'è nulla da raccontare. Condivisa da tutti gli
 * effetti danno di applySpellEffect, resolveElementalExplosions e resolvePreparation (veleno). */
function logDamage(
  state: GameState,
  role: PlayerId,
  amount: number,
  source: DamageLogSource,
): GameState {
  return amount > 0 ? appendLog(state, { type: 'damage', role, amount, source }) : state;
}

/** Come logDamage sopra, ma per la cura — unica fonte oggi è l'effetto 'heal' di un incantesimo. */
function logHeal(state: GameState, role: PlayerId, amount: number, spellId: string): GameState {
  return amount > 0 ? appendLog(state, { type: 'healed', role, amount, spellId }) : state;
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

/** Quante carte del pool (tipicamente mano + mazzo + scarti di UN giocatore) sono utili per la
 * formula indicata — pensata per un tooltip di riferimento rapido (Qualità della vita, magie
 * pinnate), non per verificare "posso crearla ora" (hasElements sopra fa quello, consumando
 * esattamente gli ingredienti uno a uno). Ogni carta è contata al più una volta: elemento+tier
 * esatti richiesti dalla formula, oppure — se la formula contiene almeno un elemento base — un
 * Residuo Arcano (2.5, jolly valido solo per i base). La chiave `element:tier` esclude le carte
 * 'spell' (il cui `Card.element` è solo arte/icona, non un ingrediente disponibile, vedi
 * card.model.ts). */
export function countMatchingCards(cards: readonly Card[], formula: readonly Element[]): number {
  const required = new Set(formula.map((el) => `${el}:${elementTier(el)}`));
  const hasBaseElement = formula.some((el) => elementTier(el) === 'base');

  let count = 0;
  for (const card of cards) {
    if (required.has(`${card.element}:${card.tier}`)) count++;
    else if (hasBaseElement && card.tier === 'residium') count++;
  }
  return count;
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
  const next = updatePlayer(withDiscards, role, {
    discards: [...player.discards, kept],
    pendingCollect: null,
    hasCollectedThisTurn: true,
    collectDrawBatchId: player.collectDrawBatchId + 1,
  });
  return appendLog(next, { type: 'cardCollected', role });
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
    collectDrawBatchId: player.collectDrawBatchId + 1,
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

  return appendLog(
    updatePlayer(state, role, {
      hand,
      wand: { ...player.wand, tipSlot },
      discards: [...player.discards, ...discardedCards, spellCard],
    }),
    { type: 'spellCreated', role, spellId },
  );
}

/** Mana vitale/caotico (3.2.2/3.2.3): PS extra restituiti al lanciatore, o danni extra inflitti all'avversario, per ogni carta di quel tipo spesa in pagamento — calcolati qui (non in resolveSpells) perché le carte di pagamento vengono scartate subito e non sarebbero più consultabili al momento della risoluzione. Si applicano solo se la magia include un effetto rispettivamente 'heal'/'damage' (vedi applySpellEffect) — altrimenti restano inerti, la carta vale come un mana comune. */
const SPECIAL_MANA_EFFECT_AMOUNT = 2;

/**
 * Fase Azione (5.2): lancia una carta incantesimo dalla mano, pagandone subito il costo in mana
 * scartando le carte indicate. L'effetto NON si applica qui — resta in sospeso in pendingSpells fino
 * al passaggio in fase Incantesimo (vedi resolveSpells, agganciata in advanceTurnPhase), come da
 * regolamento 4.4/4.5. No-op se: non sei di turno, non sei in Azione, la carta non è un incantesimo
 * valido, le carte di pagamento indicate non coprono il costo (tier 'spell'/'freeze' esclusi dal
 * pagamento: non sono elementi, 3.1), o — per le magie con un effetto in TARGET_CARD_EFFECT_TYPES
 * (es. 'boost_card_mana') — ci sono carte bersaglio candidate nei PROPRI scarti (tier base/avanzato/
 * potente) ma `targetCardId` non punta a nessuna di esse. Se invece gli scarti non hanno nessuna
 * carta candidata, il bersaglio è semplicemente saltato (non bloccante): la magia si lancia comunque,
 * ma resta senza effetto alla risoluzione (vedi applyBoostCardMana). `targetCardIds` è l'analogo per
 * MULTI_TARGET_CARD_EFFECT_TYPES (es. 'consume_discards', "Sciogliere"): fino a `effect.amount`
 * carte dallo stesso pool, ma qui 0 è SEMPRE valido (mai bloccante) — id extra o duplicati oltre il
 * tetto, o non presenti nel pool eleggibile, fanno fallire il lancio (return state).
 */
export function castSpell(
  state: GameState,
  role: PlayerId,
  spellCardId: string,
  paidCardIds: readonly string[],
  targetCardId?: string,
  targetCardIds?: readonly string[],
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

  const needsTargetCard = spell.effects.some((e) => TARGET_CARD_EFFECT_TYPES.includes(e.type));
  let resolvedTargetCardId: string | undefined;
  if (needsTargetCard) {
    const eligibleDiscards = player.discards.filter(
      (c) => c.tier === 'base' || c.tier === 'advanced' || c.tier === 'superior',
    );
    if (eligibleDiscards.length > 0) {
      if (!eligibleDiscards.some((c) => c.id === targetCardId)) return state;
      resolvedTargetCardId = targetCardId;
    }
  }

  // 'consume_discards' ecc. (MULTI_TARGET_CARD_EFFECT_TYPES): a differenza del blocco sopra, qui 0
  // bersagli è SEMPRE valido — non un fallback per scarti vuoti, ma la scelta normale di chi non
  // vuole consumare nulla. Fallisce solo per input scorretto (duplicati, oltre il tetto, o una carta
  // non eleggibile) — mai per assenza di scelta.
  const multiTargetEffect = spell.effects.find((e) =>
    MULTI_TARGET_CARD_EFFECT_TYPES.includes(e.type),
  );
  let resolvedTargetCardIds: string[] | undefined;
  if (multiTargetEffect) {
    const eligibleTiers = multiTargetEffect.consumableCardTiers ?? DEFAULT_CONSUMABLE_CARD_TIERS;
    const eligibleDiscards = player.discards.filter((c) => eligibleTiers.includes(c.tier));
    const requested = targetCardIds ?? [];
    const max = multiTargetEffect.amount ?? 0;
    if (new Set(requested).size !== requested.length) return state;
    if (requested.length > max) return state;
    if (!requested.every((id) => eligibleDiscards.some((c) => c.id === id))) return state;
    if (requested.length > 0) resolvedTargetCardIds = [...requested];
  }

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
  // targetCardId va OMESSO (non impostato a `undefined`) quando assente: Firestore rifiuta
  // qualunque campo con valore `undefined` in un documento, ovunque sia annidato — un
  // `Transaction.update()`/`updateDoc()` con un `undefined` nascosto dentro un array fallisce
  // sempre con "Unsupported field value: undefined", a differenza di `null` che è permesso.
  const pendingSpell: PendingSpell = {
    card: spellCard,
    vitalBonus,
    chaoticBonus,
    ...(needsTargetCard && resolvedTargetCardId !== undefined
      ? { targetCardId: resolvedTargetCardId }
      : {}),
    ...(resolvedTargetCardIds !== undefined ? { targetCardIds: resolvedTargetCardIds } : {}),
  };
  return appendLog(
    updatePlayer(state, role, {
      hand: player.hand.filter((c) => !spentIds.has(c.id)),
      discards: [...player.discards, ...discardedPaidCards],
      pendingSpells: [...player.pendingSpells, pendingSpell],
      spellsPlayedThisTurn: player.spellsPlayedThisTurn + 1,
      wand: tipWasSpent ? { ...player.wand, tipSlot: null } : player.wand,
      tipCardPlacedTurn: tipWasSpent ? null : player.tipCardPlacedTurn,
    }),
    { type: 'spellCast', role, spellId: spellCard.spellId },
  );
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

  return appendLog(
    updatePlayer(state, role, {
      hand: player.hand.filter((c) => c.id !== cardId),
      wand: { ...player.wand, tipSlot: card },
      tipCardPlacedTurn: state.turnNumber,
    }),
    { type: 'wandTipHeld', role, element: card.element as BaseElement },
  );
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

  return appendLog(
    {
      ...updatePlayer(state, role, {
        hand: player.hand.filter((c) => c.id !== cardId),
        wand: { ...player.wand, [socketField]: card.element },
      }),
      commonDiscards: [...state.commonDiscards, card],
    },
    { type: 'wandSocketed', role, slot: target, element: card.element as BaseElement },
  );
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
  const logged = appendLog(withHand, {
    type: 'combined',
    role,
    kind: 'advanced',
    element: taken.obtained.element,
  });

  // Esplosione elementale (2.4): il nuovo slot rivelato in Fonte Arcana da takeFromFonte potrebbe
  // essere Luce o Tenebra (la carta ottenuta qui è sempre un avanzato, mai un potente).
  return resolveElementalExplosions(logged);
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
  const logged = appendLog(withHand, {
    type: 'combined',
    role,
    kind: 'superior',
    element: taken.obtained.element,
  });

  // Esplosione elementale (2.4): il nuovo slot rivelato in Fonte Arcana da takeFromFonte potrebbe
  // essere l'elemento potente opposto a quello appena ottenuto qui (che va negli scarti, non in mano).
  return resolveElementalExplosions(logged);
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
  return appendLog(
    updatePlayer(withDeck, role, {
      hand: handAfterB,
      discards: [...player.discards, obtained],
      wand: { ...player.wand, tipSlot: tipAfterB },
    }),
    { type: 'combined', role, kind: 'residue', element: obtained.element },
  );
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
  // scarti nel mazzo (regolamento 1.7).
  const { drawn, deck, discards } = drawUpTo(
    player.deck,
    [...player.discards, ...handAfterExpiry],
    HAND_SIZE,
  );

  const stateWithCommonDiscards: GameState = {
    ...state,
    commonDiscards: commonDiscardsAfterTip,
  };
  const stateAfterEnd = updatePlayer(stateWithCommonDiscards, role, {
    hand: drawn,
    deck,
    discards,
    hasCollectedThisTurn: false,
    spellsPlayedThisTurn: 0,
    wand,
    tipCardPlacedTurn,
    handDrawBatchId: player.handDrawBatchId + 1,
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
 * Fase Preparazione (4.2): 1 danno per ogni livello di Avvelenamento accumulato — poi il livello
 * stesso si riduce di 1 (floor 0), scioglimento (rimozione dal gioco, non scarto) delle carte
 * Congelamento eventualmente in mano (Card.expiresAt 'preparazione', vedi applyFreeze), e istantanea
 * dello stato della punta della bacchetta (PlayerState.tipHeldAtPreparation, 1.4.1) usata da
 * holdAtTip per limitare il potere a turni alterni. Il decadimento qui è AGGIUNTIVO rispetto a
 * quello per rimescolamento del mazzo (drawUpTo in endTurn/applyDiscardHand, 2.3.4/1.7 originale) —
 * bilanciamento: prima si riduceva solo rimescolando, troppo raro perché il livello scendesse mai
 * sotto il cap (3) con un mazzo da 10+ carte, rendendo l'Avvelenamento pressoché permanente e troppo
 * forte. Il danno usa il livello PRIMA del decadimento (l'ultimo colpo pieno prima di scendere), non
 * quello dopo. Incrementa poisonDamageBatchId/lastPoisonDamage (GameState) SOLO se è stato inflitto
 * davvero un danno — segnale esplicito per il client, vedi il commento su quei campi in
 * game.model.ts: la stessa transazione di endTurn può risolvere anche un'Esplosione elementale
 * subito dopo, un semplice diff sull'HP non basterebbe a isolare la sola quota di veleno.
 */
function resolvePreparation(state: GameState, target: PlayerId): GameState {
  const player = state.players[target];
  const poisonDamage = player.tokens.poison;
  const poison = Math.max(0, player.tokens.poison - 1);
  const meltedCount = player.hand.filter((c) => c.tier === 'freeze').length;
  const hand = resolveExpiringCards(player.hand, 'preparazione');

  let next = updatePlayer(state, target, {
    hp: player.hp - poisonDamage,
    hand,
    tokens: { ...player.tokens, poison },
    tipHeldAtPreparation: !!player.wand.tipSlot,
  });

  next = logDamage(next, target, poisonDamage, { kind: 'poison' });
  if (meltedCount > 0) {
    next = appendLog(next, { type: 'freezeResolved', role: target, count: meltedCount });
  }

  if (poisonDamage === 0) return next;

  // Number.isNaN, non solo ?? 0: partite create prima dell'introduzione di questo campo hanno
  // poisonDamageBatchId undefined sul documento Firestore — undefined + 1 produce NaN, e NaN è
  // per definizione diverso da se stesso (NaN !== NaN), quindi il confronto "il veleno è appena
  // cambiato?" in derive-events.ts risulterebbe vero per SEMPRE da quel punto in poi, a ogni
  // scrittura successiva sul documento, non solo quando il veleno scatta davvero (bug osservato:
  // +1 cuore fantasma insieme al -1 teschio a ogni aggiornamento). ?? da solo non basta: sostituisce
  // solo null/undefined, non NaN (che è comunque un "number" valido).
  const currentBatchId = Number.isNaN(next.poisonDamageBatchId) ? 0 : next.poisonDamageBatchId;

  return {
    ...next,
    poisonDamageBatchId: currentBatchId + 1,
    lastPoisonDamage: { role: target, amount: poisonDamage },
  };
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

/** Scudo (2.3.3): assorbe danno prima dei PS — l'eccedenza rispetto allo scudo disponibile passa a hp, lo scudo assorbito si consuma (mai sotto 0, mai oltre `amount`). Usata solo dal case 'damage' sotto — 'damage_ignore_shields' bypassa questa funzione apposta, va dritto a hp. */
function absorbWithShield(shield: number, amount: number): { hpLoss: number; shieldLeft: number } {
  const absorbed = Math.min(shield, Math.max(0, amount));
  return { hpLoss: amount - absorbed, shieldLeft: shield - absorbed };
}

/**
 * Rischio: conta le coppie di elementi AVANZATI (Tuono/Veleno/Ghiaccio/Lava — non Luce/Tenebra, quelli
 * esploderebbero all'istante se compresenti in Fonte Arcana, 2.4, quindi non ci restano mai abbastanza
 * a lungo da formare una "coppia" osservabile) tra le carte attualmente rivelate in Fonte Arcana. Una
 * coppia è per singolo elemento: 4 copie dello stesso avanzato contano 2 coppie, non 1 — con soli 4
 * slot visibili il massimo raggiungibile è comunque 2 (richiede tutti e 4 gli slot sullo stesso
 * elemento, o due coppie di elementi diversi). Usata da applySpellEffect per 'damage_from_fonte'.
 */
function countAdvancedPairsInFonte(fonteElementale: readonly Card[]): number {
  const counts = new Map<Element, number>();
  for (const card of fonteElementale) {
    if (elementTier(card.element) !== 'advanced') continue;
    counts.set(card.element, (counts.get(card.element) ?? 0) + 1);
  }
  let pairs = 0;
  for (const count of counts.values()) pairs += Math.floor(count / 2);
  return pairs;
}

const FONTE_PAIR_DAMAGE = 3;

/** Applica un singolo effetto di un incantesimo lanciato — 'damage'/'damage_ignore_shields'/'damage_self'/'damage_halve_opponent'/'damage_from_fonte'/'heal'/'shield_add'/'shield_remove_opponent'/'poison_add'/'poison_clear_self'/'ice_add'/'ice_clear_self'/'opponent_discard_random'/'opponent_discard_hand'/'reveal_opponent_hand'/'fonte_reset'/'boost_card_mana'/'consume_discards' per ora; 'element_immunity' resta l'unico SpellEffectType senza risoluzione (no-op, rimandato — vedi spell.model.ts). `pending` porta sia il mana speciale (3.2.2/3.2.3, calcolato al pagamento in castSpell: si somma solo all'effetto corrispondente — vitale→heal, caotico→damage/damage_ignore_shields/damage_from_fonte, tutti e 3 danno all'avversario "nel modo standard", altrimenti resta inerte, gli altri non ne beneficiano di proposito) sia l'eventuale carta/e bersaglio scelte dal giocatore (`targetCardId` per 'boost_card_mana', `targetCardIds` per 'consume_discards' — TARGET_CARD_EFFECT_TYPES/MULTI_TARGET_CARD_EFFECT_TYPES in spell.model.ts). `spellElement` (Spell.element) alimenta la Resistenza/Vulnerabilità dell'asta (1.4.2, applyBodyResistance) sui tre effetti danno "normali" (non 'damage_from_fonte': `element` è sempre assente sulla sua formula, 4 basi miste senza un elemento portante, vedi risk in SPELL_CATALOG), ciascuno sull'asta del proprio bersaglio (avversario per 'damage'/'damage_ignore_shields', il lanciatore stesso per 'damage_self') — 'damage_halve_opponent' ne resta fuori apposta (dimezza l'hp corrente, un valore già post-asta/scudo di colpi precedenti, non un nuovo danno da filtrare) e gli altri non sono mai elementali. Nessun clamp su hp qui: può scendere sotto 0, la condizione di vittoria (resolveVictory, in fondo al file) se ne accorge comunque con un semplice `<= 0`, applicata centralmente da GameEngineService.mutate() dopo ogni reducer. */
function applySpellEffect(
  state: GameState,
  casterRole: PlayerId,
  effect: SpellEffect,
  pending: Pick<PendingSpell, 'vitalBonus' | 'chaoticBonus' | 'targetCardId' | 'targetCardIds'>,
  spellElement: BaseElement | undefined,
  spellId: string,
): GameState {
  const opponentRole: PlayerId = casterRole === 'host' ? 'guest' : 'host';
  switch (effect.type) {
    case 'damage': {
      const opponent = state.players[opponentRole];
      const amount =
        applyBodyResistance(effect.amount ?? 0, spellElement, opponent.wand.bodySocket) +
        pending.chaoticBonus;
      const { hpLoss, shieldLeft } = absorbWithShield(opponent.tokens.shield, amount);
      const next = updatePlayer(state, opponentRole, {
        hp: opponent.hp - hpLoss,
        tokens: { ...opponent.tokens, shield: shieldLeft },
      });
      return logDamage(next, opponentRole, hpLoss, { kind: 'spell', spellId });
    }
    case 'damage_ignore_shields': {
      const opponent = state.players[opponentRole];
      const amount =
        applyBodyResistance(effect.amount ?? 0, spellElement, opponent.wand.bodySocket) +
        pending.chaoticBonus;
      const next = updatePlayer(state, opponentRole, { hp: opponent.hp - amount });
      return logDamage(next, opponentRole, amount, { kind: 'spell', spellId });
    }
    case 'damage_self': {
      const caster = state.players[casterRole];
      const amount = applyBodyResistance(effect.amount ?? 0, spellElement, caster.wand.bodySocket);
      const { hpLoss, shieldLeft } = absorbWithShield(caster.tokens.shield, amount);
      const next = updatePlayer(state, casterRole, {
        hp: caster.hp - hpLoss,
        tokens: { ...caster.tokens, shield: shieldLeft },
      });
      return logDamage(next, casterRole, hpLoss, { kind: 'spell', spellId });
    }
    case 'damage_halve_opponent': {
      const opponent = state.players[opponentRole];
      const newHp = Math.floor(opponent.hp / 2);
      const next = updatePlayer(state, opponentRole, { hp: newHp });
      return logDamage(next, opponentRole, opponent.hp - newHp, { kind: 'spell', spellId });
    }
    case 'damage_from_fonte': {
      const opponent = state.players[opponentRole];
      const pairs = countAdvancedPairsInFonte(state.fonteElementale);
      const amount = pairs * FONTE_PAIR_DAMAGE + pending.chaoticBonus;
      const { hpLoss, shieldLeft } = absorbWithShield(opponent.tokens.shield, amount);
      const next = updatePlayer(state, opponentRole, {
        hp: opponent.hp - hpLoss,
        tokens: { ...opponent.tokens, shield: shieldLeft },
      });
      return logDamage(next, opponentRole, hpLoss, { kind: 'spell', spellId });
    }
    case 'heal': {
      const caster = state.players[casterRole];
      const amount = (effect.amount ?? 0) + pending.vitalBonus;
      const next = updatePlayer(state, casterRole, { hp: caster.hp + amount });
      return logHeal(next, casterRole, amount, spellId);
    }
    case 'boost_card_mana':
      return applyBoostCardMana(state, casterRole, pending.targetCardId, effect.amount ?? 1);
    case 'consume_discards':
      return applyConsumeDiscards(state, casterRole, pending.targetCardIds, effect.amount ?? 0);
    case 'shield_add': {
      const amount = effect.amount ?? 0;
      const next = applyShield(state, casterRole, amount);
      return amount > 0
        ? appendLog(next, { type: 'shieldGained', role: casterRole, amount })
        : next;
    }
    case 'shield_remove_opponent':
      return applyShieldRemove(state, opponentRole, effect.amount);
    case 'poison_add':
      return applyPoison(state, opponentRole, effect.amount ?? 0);
    case 'poison_clear_self':
      return applyPoisonClear(state, casterRole);
    case 'ice_add':
      return applyFreeze(state, opponentRole, effect.amount ?? 0);
    case 'ice_clear_self':
      return applyIceClear(state, casterRole);
    case 'opponent_discard_random': {
      const before = state.players[opponentRole].hand.length;
      const next = applyDiscardRandom(state, opponentRole, effect.amount ?? 1);
      const discarded = before - next.players[opponentRole].hand.length;
      return discarded > 0
        ? appendLog(next, {
            type: 'opponentForcedDiscard',
            role: casterRole,
            count: discarded,
            full: false,
          })
        : next;
    }
    case 'opponent_discard_hand': {
      const next = applyDiscardHand(state, opponentRole);
      return appendLog(next, {
        type: 'opponentForcedDiscard',
        role: casterRole,
        count: 0,
        full: true,
      });
    }
    case 'reveal_opponent_hand': {
      const alreadyRevealed = new Set(
        state.players[opponentRole].hand.filter((c) => c.revealedToOpponent).map((c) => c.id),
      );
      const next = applyRevealHand(state, opponentRole, effect.amount, effect.cardTierFilter);
      const newlyRevealed = next.players[opponentRole].hand.filter(
        (c) => c.revealedToOpponent && !alreadyRevealed.has(c.id),
      ).length;
      return newlyRevealed > 0
        ? appendLog(next, {
            type: 'handRevealed',
            role: casterRole,
            full: effect.amount === undefined,
          })
        : next;
    }
    case 'fonte_reset':
      return appendLog(applyFonteReset(state), { type: 'fonteReset', role: casterRole });
    default:
      return state;
  }
}

/**
 * Fase Incantesimo (4.5/5.3): risolve le magie lanciate in Azione (pendingSpells) — applica gli
 * effetti di ciascuna (più l'eventuale bonus di mana speciale calcolato al pagamento, 3.2.2/3.2.3),
 * poi le sposta tutte negli scarti del lanciatore e svuota pendingSpells. Agganciata dentro
 * advanceTurnPhase, non da un endpoint separato. Chiude con resolveElementalExplosions (2.4): alcuni
 * effetti (es. opponent_discard_hand, fonte_reset) pescano carte fresche in una mano o rivelano nuovi
 * slot in Fonte Arcana, che potrebbero introdurre Luce+Tenebra insieme — stesso motivo per cui
 * endTurn/combineElements/combineSuperior la richiamano già, mancava solo qui.
 */
function resolveSpells(state: GameState, role: PlayerId): GameState {
  const player = state.players[role];
  if (player.pendingSpells.length === 0) return state;

  let next = state;
  for (const pending of player.pendingSpells) {
    const spell = SPELL_CATALOG.find((s) => s.id === pending.card.spellId);
    if (!spell) continue;
    for (const effect of spell.effects)
      next = applySpellEffect(next, role, effect, pending, spell.element, spell.id);
  }

  const caster = next.players[role];
  const withDiscards = updatePlayer(next, role, {
    discards: [...caster.discards, ...player.pendingSpells.map((p) => p.card)],
    pendingSpells: [],
  });
  return resolveElementalExplosions(withDiscards);
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
      next = logDamage(next, role, 1, { kind: 'explosion' });
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
    next = logDamage(next, 'host', 1, { kind: 'explosion' });
    next = logDamage(next, 'guest', 1, { kind: 'explosion' });
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
 * Disintossicazione (2.3.4): azzera il livello di Avvelenamento del bersaglio, qualunque esso sia —
 * l'inverso di applyPoison. Chiamata da applySpellEffect per il tipo 'poison_clear_self', sempre col
 * lanciatore stesso come target (una "cura di sé", mai sull'avversario).
 */
export function applyPoisonClear(state: GameState, target: PlayerId): GameState {
  const player = state.players[target];
  return updatePlayer(state, target, { tokens: { ...player.tokens, poison: 0 } });
}

/**
 * Scudo (2.3.3): aumenta lo scudo del bersaglio, senza cap (a differenza del Veleno, il regolamento
 * non fissa un tetto — Egida in SPELL_CATALOG ne dà già 5 in un colpo solo). Chiamata da
 * applySpellEffect per il tipo 'shield_add' con target sempre il lanciatore stesso (protezione su di
 * sé, mai sull'avversario) — il consumo (assorbimento del danno in arrivo) resta indipendente, vedi
 * absorbWithShield sopra.
 */
export function applyShield(state: GameState, target: PlayerId, amount: number): GameState {
  const player = state.players[target];
  return updatePlayer(state, target, {
    tokens: { ...player.tokens, shield: player.tokens.shield + amount },
  });
}

/**
 * Frattura/Breccia (2.3.3): rimuove scudo dal bersaglio — l'inverso di applyShield. `amount`
 * assente (Breccia, "annulla lo scudo dell'avversario" senza numero) azzera tutto lo scudo in un
 * colpo, indipendentemente da quanto ne aveva, invece di sottrarre una quantità fissa (Frattura,
 * `amount: 2`) — stesso schema "amount assente = tutto" di applyPoisonClear/applyIceClear. Chiamata
 * da applySpellEffect per il tipo 'shield_remove_opponent', sempre col bersaglio l'avversario del
 * lanciatore (un incantesimo offensivo/anti-difesa, mai su di sé).
 */
export function applyShieldRemove(state: GameState, target: PlayerId, amount?: number): GameState {
  const player = state.players[target];
  const shield = amount === undefined ? 0 : Math.max(0, player.tokens.shield - amount);
  return updatePlayer(state, target, { tokens: { ...player.tokens, shield } });
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

/**
 * Calore (2.3.1): rimuove tutte le carte Congelamento dalla pila degli scarti del bersaglio — solo
 * da lì, non da mano/mazzo (una carta 'freeze' già in mano o già rimescolata nel mazzo si scioglie
 * comunque al proprio turno in fase Preparazione, resolveExpiringCards; questo effetto previene
 * solo le PROSSIME pescate dagli scarti attuali). Chiamata da applySpellEffect per il tipo
 * 'ice_clear_self', sempre col lanciatore stesso come target (una "cura di sé", mai sull'avversario).
 */
export function applyIceClear(state: GameState, target: PlayerId): GameState {
  const player = state.players[target];
  const discards = player.discards.filter((c) => c.tier !== 'freeze');
  return updatePlayer(state, target, { discards });
}

/**
 * Raffica violenta: scarta `count` carte scelte a caso dalla mano del bersaglio (finiscono nei suoi
 * scarti). Residuo Arcano e mana accumulato fanno eccezione: se pescati a caso non finiscono negli
 * scarti come farebbe una carta qualunque — si consumano/svaniscono, stesso trattamento che
 * ricevono ovunque nel motore quando lasciano la mano (createSpell/castSpell escludono tier
 * 'residium'/'mana' dagli scarti allo stesso modo). Chiamata da applySpellEffect per il tipo
 * 'opponent_discard_random', sempre col bersaglio l'avversario del lanciatore.
 */
export function applyDiscardRandom(state: GameState, target: PlayerId, count: number): GameState {
  const player = state.players[target];
  const hand = [...player.hand];
  const discarded: Card[] = [];
  for (let i = 0; i < count && hand.length > 0; i++) {
    const index = Math.floor(Math.random() * hand.length);
    const [card] = hand.splice(index, 1);
    if (card.tier !== 'residium' && card.tier !== 'mana') discarded.push(card);
  }
  return updatePlayer(state, target, { hand, discards: [...player.discards, ...discarded] });
}

/**
 * Colpo basso: scarta l'intera mano del bersaglio e ne pesca subito 5 fresche — stessa identica
 * meccanica del ciclo mano di endTurn (resolveExpiringCards 'fine' PRIMA dello scarto, altrimenti un
 * Residuo Arcano/mana accumulato ancora in mano finirebbe negli scarti come una carta qualunque
 * invece di consumarsi; poi drawUpTo, che rimescola gli scarti nel mazzo se necessario), applicata
 * però solo alla mano — non tocca wand/flag di turno del bersaglio, a differenza di endTurn. Chiamata
 * da applySpellEffect per il tipo 'opponent_discard_hand', sempre col bersaglio l'avversario del
 * lanciatore.
 */
export function applyDiscardHand(state: GameState, target: PlayerId): GameState {
  const player = state.players[target];
  const handAfterExpiry = resolveExpiringCards(player.hand, 'fine');
  const { drawn, deck, discards } = drawUpTo(
    player.deck,
    [...player.discards, ...handAfterExpiry],
    HAND_SIZE,
  );
  return updatePlayer(state, target, {
    hand: drawn,
    deck,
    discards,
    handDrawBatchId: player.handDrawBatchId + 1,
  });
}

/**
 * Terzo occhio/Occhio supremo/Occhio arcano: marca `count` carte scelte a caso nella mano del
 * bersaglio come rivelate all'avversario (Card.revealedToOpponent) — `count` assente marca l'INTERA
 * mano invece di un numero fisso, stesso schema "amount assente = tutto" di
 * applyShieldRemove/applyPoisonClear/applyIceClear. `tierFilter` (SpellEffect.cardTierFilter),
 * quando presente, restringe il pescaggio casuale alle sole carte di quel tier (es. 'spell', per
 * rivelare specificamente una magia invece di una carta qualunque) — se il bersaglio non ne ha,
 * no-op, stesso "rischio di whiff" del bersaglio negli scarti di boost_card_mana. Il pescaggio
 * casuale esclude le carte già rivelate: un ricasting deve poter sempre colpirne una nuova finché
 * ce ne sono, non rischiare di ripescare a caso una già rivelata (nessun cambiamento visibile, il
 * colpo sprecato). A differenza di
 * applyDiscardRandom/applyDiscardHand le carte non si spostano: la marcatura è permanente sulla
 * carta stessa (nessuna "guarigione" implementata oggi), quindi resta anche se la carta lascia la
 * mano e ci torna più avanti (scarti, rimescolata, ripescata) — non un effetto temporaneo legato al
 * turno. Chiamata da applySpellEffect per il tipo 'reveal_opponent_hand', sempre col bersaglio
 * l'avversario del lanciatore.
 */
export function applyRevealHand(
  state: GameState,
  target: PlayerId,
  count?: number,
  tierFilter?: CardTier,
): GameState {
  const player = state.players[target];
  const matchesTier = (i: number) => !tierFilter || player.hand[i].tier === tierFilter;

  if (count === undefined) {
    const eligible = new Set(player.hand.map((_, i) => i).filter(matchesTier));
    const hand = player.hand.map((c, i) =>
      eligible.has(i) ? { ...c, revealedToOpponent: true } : c,
    );
    return updatePlayer(state, target, { hand });
  }

  // Esclude le carte già rivelate dal pool: un ricasting di Terzo occhio/Occhio arcano (o un
  // secondo bersaglio già colpito da Sguardo Incantato) deve avere sempre la possibilità di
  // rivelarne una NUOVA, non rischiare di ripescare a caso una già rivelata (nessun cambiamento
  // visibile, il colpo va sprecato) finché ne restano di non rivelate da colpire.
  const eligibleIndices = player.hand
    .map((_, i) => i)
    .filter((i) => matchesTier(i) && !player.hand[i].revealedToOpponent);

  const revealCount = Math.min(count, eligibleIndices.length);
  const pool = [...eligibleIndices];
  const chosen = new Set<number>();
  while (chosen.size < revealCount) {
    const pickAt = Math.floor(Math.random() * pool.length);
    chosen.add(pool.splice(pickAt, 1)[0]);
  }
  const hand = player.hand.map((c, i) => (chosen.has(i) ? { ...c, revealedToOpponent: true } : c));
  return updatePlayer(state, target, { hand });
}

// Stesso valore di FONTE_VISIBLE_COUNT in deck-builder.ts (non esportata, duplicata qui — solo
// applyFonteReset se ne serve, non vale la pena esportarla per un singolo chiamante).
const FONTE_RESET_COUNT = 4;

/**
 * Reset (5.x): scarta le 4 carte attualmente rivelate in Fonte Arcana negli scarti del mazzo
 * avanzato e ne rivela 4 nuove al loro posto, in un colpo solo — stesso drawUpTo() di
 * takeFromFonte, ma su tutti gli slot insieme invece che uno alla volta quando viene consumato in
 * una combinazione. Se il mazzo avanzato + i suoi scarti (comprese le 4 carte appena scartate) non
 * bastano a fornire 4 carte, la Fonte Arcana torna con meno di 4 slot visibili — stesso caso limite
 * di takeFromFonte. Chiamata da applySpellEffect per il tipo 'fonte_reset', unico effetto che non
 * tocca lo stato di un giocatore ma solo lo stato condiviso del tavolo.
 */
export function applyFonteReset(state: GameState): GameState {
  const {
    drawn: fonteElementale,
    deck: advancedDeck,
    discards: advancedDiscards,
  } = drawUpTo(
    state.advancedDeck,
    [...state.advancedDiscards, ...state.fonteElementale],
    FONTE_RESET_COUNT,
  );
  return { ...state, fonteElementale, advancedDeck, advancedDiscards };
}

/**
 * Migliora mana: aumenta permanentemente il valore di mana di UNA carta scelta nei PROPRI scarti
 * (Card.manaBonus, lo stesso campo del bonus manico 1.4.3 — le due fonti si sommano,
 * computePlayerMana le somma già entrambe senza bisogno di modifiche, quando la carta verrà ripescata
 * in un mazzo futuro rimescolamento). `targetCardId` è scelto dal giocatore al momento del lancio,
 * non un target cablato come per gli altri effetti — validato in castSpell (deve essere un elemento
 * reale — base/avanzato/potente — negli scarti al momento del lancio) e portato fin qui dentro
 * PendingSpell. No-op se assente (nessuna carta candidata negli scarti al lancio, o guard difensivo
 * se la carta è comunque sparita dagli scarti — non dovrebbe succedere nello stesso turno).
 */
function applyBoostCardMana(
  state: GameState,
  target: PlayerId,
  targetCardId: string | undefined,
  amount: number,
): GameState {
  if (!targetCardId) return state;
  const player = state.players[target];
  const index = player.discards.findIndex((c) => c.id === targetCardId);
  if (index === -1) return state;
  const discards = [...player.discards];
  const card = discards[index];
  discards[index] = { ...card, manaBonus: (card.manaBonus ?? 0) + amount };
  return updatePlayer(state, target, { discards });
}

/**
 * "Sciogliere"/"Distruggere" (Lava, 2.3.3 — "consumare carte per alleggerire il mazzo",
 * elements.md): consuma fino a `maxAmount` carte scelte dal giocatore nei PROPRI scarti. Elementi
 * veri tornano negli scarti del mazzo COMUNE (tier 'base') o AVANZATO (tier 'advanced'/'superior')
 * a cui appartengono, mai in quelli del giocatore stesso — stesso instradamento per tier già usato
 * da combineElements/resolveElementalExplosions per le carte consumate dalla mano. Incantesimi e
 * carte effetto (tier 'spell'/'freeze', eleggibili solo per magie con consumableCardTiers allargato
 * — es. 'destroy') non appartengono a nessun mazzo condiviso: consumarli li fa sparire dal gioco,
 * semplicemente non finiscono in nessuna delle due pile sotto. `targetCardIds` è scelto dal
 * giocatore al momento del lancio (0..maxAmount, mai obbligatorio a differenza di
 * applyBoostCardMana) e già validato in castSpell (solo tier eleggibili per la magia, nessun
 * duplicato, entro il tetto); `slice` qui è solo un guard difensivo, non dovrebbe mai tagliare
 * nulla. No-op se assente/vuoto o se le carte sono comunque sparite dagli scarti nel frattempo.
 */
function applyConsumeDiscards(
  state: GameState,
  target: PlayerId,
  targetCardIds: readonly string[] | undefined,
  maxAmount: number,
): GameState {
  if (!targetCardIds || targetCardIds.length === 0) return state;
  const player = state.players[target];
  const ids = new Set(targetCardIds.slice(0, maxAmount));
  const consumed = player.discards.filter((c) => ids.has(c.id));
  if (consumed.length === 0) return state;
  const remainingDiscards = player.discards.filter((c) => !ids.has(c.id));
  const consumedBase = consumed.filter((c) => c.tier === 'base');
  const consumedAdvanced = consumed.filter((c) => c.tier === 'advanced' || c.tier === 'superior');
  const next = updatePlayer(state, target, { discards: remainingDiscards });
  return {
    ...next,
    commonDiscards: [...next.commonDiscards, ...consumedBase],
    advancedDiscards: [...next.advancedDiscards, ...consumedAdvanced],
  };
}

/**
 * Condizione di vittoria (1.3, regolamento v2): "Quando i Punti Salute si riducono a 0 o meno, per
 * qualsiasi motivo, vince la partita il giocatore che ne ha ancora almeno 1". Applicata centralmente
 * da GameEngineService.mutate() dopo OGNI reducer — non sparsa nei singoli punti del motore che
 * toccano hp (danno da incantesimo, Avvelenamento in resolvePreparation, Esplosione elementale...),
 * altrimenti andrebbero enumerati e tenuti aggiornati uno per uno. Pareggio (entrambi <= 0 nello
 * stesso reducer, es. doppia Esplosione elementale in Fonte quando entrambi sono già quasi a 0): il
 * regolamento non lo prevede esplicitamente, restiamo senza winner — "comunque finita" lo segnala
 * GameDoc.status (v. isGameOver sotto), non questo campo. No-op se un winner è già stato assegnato
 * (es. da un arrendersi, GameEngineService.surrender) o se nessuno dei due è a 0.
 */
export function resolveVictory(state: GameState): GameState {
  if (state.winner) return state;
  const hostDown = state.players.host.hp <= 0;
  const guestDown = state.players.guest.hp <= 0;
  if (hostDown === guestDown) return state;
  return { ...state, winner: hostDown ? 'guest' : 'host' };
}

/** true se la partita va considerata conclusa per Punti Salute — usata da GameEngineService.mutate()
 * per decidere se portare GameDoc.status a 'finished' insieme allo stato, indipendentemente da
 * `winner` (che resta null nel caso limite di pareggio, v. resolveVictory sopra). */
export function isGameOver(state: GameState): boolean {
  return state.players.host.hp <= 0 || state.players.guest.hp <= 0;
}
