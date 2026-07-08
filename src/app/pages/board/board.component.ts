import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  OnInit,
  viewChild,
  ElementRef,
  afterNextRender,
  type WritableSignal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { GameService, type GameDoc } from '../../services/game.service';
import { GameEngineService } from '../../services/game-engine.service';
import { AuthService } from '../../services/auth.service';
import { CardComponent } from '../../components/card/card.component';
import { DeckComponent } from '../../components/deck/deck.component';
import { PlayerHudComponent, type DamageEvent } from '../../components/player-hud/player-hud.component';
import { PhaseTrackerComponent } from '../../components/phase-tracker/phase-tracker.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TooltipDirective } from '../../components/ui/tooltip/tooltip.directive';
import { ActionMenuComponent, type ActionMenuItem } from '../../components/ui/action-menu/action-menu.component';
import { GameSettingsDialogComponent } from '../../dialogs/game-settings/game-settings-dialog.component';
import { GrimoireDialogComponent } from '../../dialogs/grimoire/grimoire-dialog.component';
import { RulebookDialogComponent } from '../../dialogs/rulebook/rulebook-dialog.component';
import { CastSpellDialogComponent, type CastSpellDialogData } from '../../dialogs/cast-spell/cast-spell-dialog.component';
import type { BaseElement, Element, AdvancedElement, SuperiorElement } from '../../models/element.model';
import { ADVANCED_RECIPES, SUPERIOR_FORMULA } from '../../models/element.model';
import type { Wand } from '../../models/wand.model';
import { ELEMENT_OPPOSITES } from '../../models/wand.model';
import type { Card } from '../../models/card.model';
import type { PlayerId, PlayerState } from '../../models/player.model';
import { computePlayerMana } from '../../models/player.model';
import { SPELL_CATALOG } from '../../data/spells';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Width of a wand-section card; its paired peeking element card shares the same width. */
const WAND_CARD_WIDTH = 168;
/** Height of the peeking element card left visible above/below the wand-section card. */
const WAND_PEEK_VISIBLE = 32;
/** Height shared by all three panels (bacchetta/mano/vita) — now that none of them hide past the screen edge, this just needs to comfortably fit the wand's own text (its longest content), not the old 2:3-card-derived tall box. */
const PANEL_HEIGHT = 128;
/** Height of the compact content row inside mano/vita (mazzo+arco+scarti, or nome+barra) — shorter than PANEL_HEIGHT on purpose, so mano's arc has room to poke above it. */
const PANEL_CONTENT_HEIGHT = 100;
/** Matches --sp-3 — used to size the spacer that reserves room for the (absolutely positioned) wand panels within the row. */
const ROW_GAP = 12;

/** Width of the mazzo/scarti card-backs in the mano box (the deck/discard piles beside the arc — not the arc's own cards). */
const HAND_CARD_WIDTH = 84;
/** Width of the fanned cards in the hand itself — bigger than the mazzo/scarti beside it. */
const HAND_ARC_CARD_WIDTH = 100;
/** Resting overlap when there's room to spare — high enough that the fan never reaches into the mazzo/scarti columns next to it. */
const HAND_MIN_OVERLAP_FRACTION = 0.58;
/** Overlap cap for large hands — cards always keep at least this sliver visible. */
const HAND_MAX_OVERLAP_FRACTION = 0.8;
/** How much the outermost cards in the arc dip relative to the (highest, centered) middle card — capped well under 1/3 of the card's height. */
const HAND_ARC_DROP = 12;
/** Rotation of the outermost cards in the arc. */
const HAND_ARC_ROTATION_DEG = 10;

/** Width of the vita (PlayerHud) panel — sized so vita:mano:bacchetta ≈ 20:40:40 (bacchetta's own width is the 40% reference). */
const HUD_WIDTH = Math.round((3 * WAND_CARD_WIDTH + 2 * ROW_GAP) / 2);
/** Matches --sp-4 — the zone's own horizontal padding, which vita/bacchetta are already inset by; needed so the mano box's gap is measured from their actual edge, not from the zone's raw edge. */
const ZONE_H_PADDING = 16;
/** Gap between vita, mano and bacchetta. */
const GROUP_GAP = 24;

/** Every card in the Fonte Arcana row — deck backs, discards, the 4 slots, Residuo — shares this one width, face down or up. */
const FONTE_CARD_WIDTH = 76;
/** Gap between the 3 Fonte Arcana groups (Residuo | Base | Fonte Arcana). */
const FONTE_GROUP_GAP = 32;

/** What's currently hovered in the Fonte row — 'fixed' for an advanced card (one specific pair), 'opposite' for Residuo Arcano (any base + its opposite). */
type HoverRecipe =
  | { kind: 'fixed'; pair: readonly [BaseElement, BaseElement] }
  | { kind: 'superior' }
  | { kind: 'opposite' };

/** Durata dell'animazione di sparizione delle carte "temporanee" (Congelamento/Residuo, Card.expiresAt) — deve combaciare con @keyframes hand-card-vanish in board.component.scss. */
const VANISH_DURATION_MS = 1000;
/** Durata dell'animazione "lampo + scossa" delle carte Luce/Tenebra coinvolte in un'Esplosione elementale (2.4) in mano — deve combaciare con @keyframes hand-card-explode in board.component.scss. */
const EXPLOSION_GHOST_DURATION_MS = 700;
/** Durata del lampo + scossa sull'intera riga della Fonte Arcana quando un'Esplosione elementale (2.4) avviene lì — deve combaciare con @keyframes fonte-explode in board.component.scss. */
const FONTE_EXPLOSION_DURATION_MS = 500;

/** Una carta "temporanea" già sparita da playerHand() ma ancora mostrata come ghost, nella sua vecchia posizione, finché l'animazione di sparizione (lift + fade) non finisce — Congelamento/Residuo (Card.expiresAt). L'Esplosione elementale (2.4) ha un proprio meccanismo dedicato, vedi handExplosions più sotto. */
interface VanishingGhost {
  card: Card;
  index: number;
  total: number;
  kind: 'expiry';
}

/** Esplosione elementale (2.4) risolta in mano — le 2 carte (1 Luce + 1 Tenebra) prese direttamente dall'evento, non dedotte confrontando la mano prima/dopo (impossibile: si consumano nella stessa transazione atomica in cui entrano in mano, il client non vede mai lo stato intermedio). */
interface HandExplosion {
  role: PlayerId;
  cards: readonly Card[];
}

@Component({
  selector: 'app-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [CardComponent, DeckComponent, PlayerHudComponent, PhaseTrackerComponent, IconButtonComponent, TooltipDirective, ActionMenuComponent, TranslatePipe],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly gameEngine = inject(GameEngineService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  protected readonly i18n = inject(TranslationService);

  protected readonly ELEMENT_OPPOSITES = ELEMENT_OPPOSITES;

  protected readonly wandCardWidth = WAND_CARD_WIDTH;
  private readonly wandPeekCardHeight = Math.round(WAND_CARD_WIDTH * 1.5);
  protected readonly wandLabelHeight = PANEL_HEIGHT;
  protected readonly wandPeekOverlap = this.wandPeekCardHeight - WAND_PEEK_VISIBLE;
  /** Total width of the wand panels — used to keep the hand box clear of them horizontally. */
  protected readonly wandRowWidth = 3 * WAND_CARD_WIDTH + 2 * ROW_GAP;

  protected readonly handCardWidth = HAND_CARD_WIDTH;
  protected readonly handArcCardWidth = HAND_ARC_CARD_WIDTH;
  protected readonly visibleContentHeight = PANEL_CONTENT_HEIGHT;

  protected readonly hudWidth = HUD_WIDTH;
  /** Horizontal bounds for the (absolutely positioned) hand box, clear of vita on one side and bacchetta on the other.
   *  Both vita and bacchetta already sit inset by the zone's own padding (--sp-4), so that padding is added back in here
   *  too — otherwise the gap ends up shrunk by that same amount (the bug from the previous pass). */
  protected readonly handBoxHudInset = ZONE_H_PADDING + HUD_WIDTH + GROUP_GAP;
  protected readonly handBoxWandInset = ZONE_H_PADDING + this.wandRowWidth + GROUP_GAP;

  protected readonly fonteCardWidth = FONTE_CARD_WIDTH;
  protected readonly fonteGroupGap = FONTE_GROUP_GAP;

  protected readonly grimoireIcon = '/icons/book_2_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly rulebookIcon = '/icons/question_mark_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  private readonly playerHandTrackRef = viewChild<ElementRef<HTMLElement>>('playerHandTrack');
  private readonly opponentHandTrackRef = viewChild<ElementRef<HTMLElement>>('opponentHandTrack');
  protected readonly playerHandTrackWidth = signal(0);
  protected readonly opponentHandTrackWidth = signal(0);

  protected readonly gameId = signal<string>('');
  protected readonly gameDoc = signal<GameDoc | null>(null);

  /** Stato di gioco reale, letto dal campo `state` del documento Firestore (null finché la partita non è iniziata). */
  protected readonly state = computed(() => this.gameDoc()?.state ?? null);

  private readonly myRole = computed<PlayerId | null>(() => {
    const doc = this.gameDoc();
    const uid = this.auth.user()?.uid;
    if (!doc || !uid) return null;
    return doc.hostId === uid ? 'host' : 'guest';
  });

  private readonly me = computed(() => {
    const s = this.state();
    const role = this.myRole();
    return s && role ? s.players[role] : null;
  });

  private readonly opponentRole = computed<PlayerId | null>(() => {
    const role = this.myRole();
    return role ? (role === 'host' ? 'guest' : 'host') : null;
  });

  private readonly opponentState = computed(() => {
    const s = this.state();
    const role = this.opponentRole();
    return s && role ? s.players[role] : null;
  });

  /** Esplosione elementale (2.4): quante volte questo ruolo è stato colpito nell'ultimo batch (2.4 può risolvere più coppie in un colpo solo) — null finché non ce n'è una da mostrare. Il "lampo" sulla barra vita funziona sempre, anche quando la causa non è visibile (mano coperta dell'avversario). */
  private damageEventFor(role: PlayerId | null): DamageEvent | null {
    const s = this.state();
    if (!s || !role) return null;
    const amount = s.lastExplosions.filter(e => e.affectedRoles.includes(role)).length;
    return amount > 0 ? { id: s.explosionBatchId, amount } : null;
  }

  protected readonly playerDamageEvent = computed(() => this.damageEventFor(this.myRole()));
  protected readonly opponentDamageEvent = computed(() => this.damageEventFor(this.opponentRole()));

  protected readonly playerHealth = computed(() => ({
    max: 20,
    current: this.me()?.hp ?? 20,
    shield: this.me()?.tokens.shield ?? 0,
  }));
  protected readonly opponentHealth = computed(() => ({
    max: 20,
    current: this.opponentState()?.hp ?? 20,
    shield: this.opponentState()?.tokens.shield ?? 0,
  }));

  protected readonly playerPoisonLevel = computed(() => this.me()?.tokens.poison ?? 0);
  protected readonly opponentPoisonLevel = computed(() => this.opponentState()?.tokens.poison ?? 0);

  /** true finché restano carte Congelamento (2.3.1) non sciolte in circolazione — in mano, mazzo o scarti, non solo in mano. */
  protected readonly playerFrozen = computed(() => this.hasFreezeCards(this.me()));
  protected readonly opponentFrozen = computed(() => this.hasFreezeCards(this.opponentState()));

  protected readonly isPlayerTurn = computed(() => this.state()?.currentTurn === this.myRole());
  /** Nome di chi ha il turno in corso — mostrato dal tracker di fase centrale (unico, non duplicato per pannello). */
  protected readonly turnPlayerName = computed(() => (this.isPlayerTurn() ? this.playerName() : this.opponentName()));
  /** Azione è l'unica fase che non si auto-avanza mai da sola (l'effect nel costruttore gestisce le altre 4) — richiede sempre un input reale del giocatore. */
  protected readonly canAdvancePhase = computed(() => this.isPlayerTurn() && this.state()?.phase === 'azione');

  protected readonly opponentHandCount = computed(() => this.opponentState()?.hand.length ?? 0);
  protected readonly fonteCards = computed<Element[]>(() => this.state()?.fonteElementale.map(c => c.element) ?? []);
  /** Full Card objects (not just Element) so a card carrying a permanent bonus manico (regolamento 1.4.3) still shows its boosted mana value once drawn into hand. */
  protected readonly playerHand = computed<Card[]>(() => this.me()?.hand ?? []);

  /** Set while hovering a Fonte Arcana card or Residuo Arcano — drives the gold/blue highlight on matching hand cards. */
  protected readonly hoveredRecipe = signal<HoverRecipe | null>(null);

  protected readonly residuoDeckCount = computed(() => this.state()?.residiumDeck.length ?? 0);

  protected readonly advancedDeckCount = computed(() => this.state()?.advancedDeck.length ?? 0);
  protected readonly advancedDiscardCount = computed(() => this.state()?.advancedDiscards.length ?? 0);
  // Elementi avanzati/potenti non ricevono mai il bonus manico (solo le basi pescate dal mazzo comune, 1.4.3) — nessun topManaBonus qui.
  protected readonly advancedDiscardTop = computed(() => this.topOf(this.state()?.advancedDiscards)?.element ?? null);

  protected readonly commonDeckCount = computed(() => this.state()?.commonDeck.length ?? 0);
  protected readonly commonDiscardCount = computed(() => this.state()?.commonDiscards.length ?? 0);
  private readonly commonDiscardTopCard = computed(() => this.topOf(this.state()?.commonDiscards));
  protected readonly commonDiscardTop = computed(() => this.commonDiscardTopCard()?.element ?? null);
  protected readonly commonDiscardTopManaBonus = computed(() => this.commonDiscardTopCard()?.manaBonus ?? 0);
  /** Mana speciale (3.2): come commonDiscardTopManaBonus, senza questo una carta speciale perde il badge non appena finisce in cima a una pila (stesso bug già visto col bonus manico). */
  protected readonly commonDiscardTopSpecialMana = computed(() => this.commonDiscardTopCard()?.specialMana ?? null);

  protected readonly playerDeckCount = computed(() => this.me()?.deck.length ?? 0);
  protected readonly playerDiscardCount = computed(() => this.me()?.discards.length ?? 0);
  private readonly playerDiscardTopCard = computed(() => this.topOf(this.me()?.discards));
  protected readonly playerDiscardTop = computed(() => this.playerDiscardTopCard()?.element ?? null);
  protected readonly playerDiscardTopManaBonus = computed(() => this.playerDiscardTopCard()?.manaBonus ?? 0);
  protected readonly playerDiscardTopSpecialMana = computed(() => this.playerDiscardTopCard()?.specialMana ?? null);

  protected readonly opponentDeckCount = computed(() => this.opponentState()?.deck.length ?? 0);
  protected readonly opponentDiscardCount = computed(() => this.opponentState()?.discards.length ?? 0);
  private readonly opponentDiscardTopCard = computed(() => this.topOf(this.opponentState()?.discards));
  protected readonly opponentDiscardTop = computed(() => this.opponentDiscardTopCard()?.element ?? null);
  protected readonly opponentDiscardTopManaBonus = computed(() => this.opponentDiscardTopCard()?.manaBonus ?? 0);
  protected readonly opponentDiscardTopSpecialMana = computed(() => this.opponentDiscardTopCard()?.specialMana ?? null);

  /** Le 2 carte pescate dal mazzo comune in attesa di scelta — solo locale, nessuna scrittura su Firestore finché non si sceglie quale tenere (regolamento 4.3). */
  protected readonly pendingCollect = computed(() => this.me()?.pendingCollect ?? null);
  /** Id delle carte pescate il cui bonus manico (regolamento 1.4.3) è già stato rivelato in UI — il bonus è già risolto lato stato, ma resta nascosto un attimo per farlo notare (vedi l'effect nel costruttore). */
  protected readonly revealedBonusIds = signal<ReadonlySet<string>>(new Set());
  protected readonly canCollect = computed(() =>
    this.isPlayerTurn() && this.state()?.phase === 'raccolta' && !this.me()?.hasCollectedThisTurn && !this.pendingCollect(),
  );

  protected readonly playerName = computed(() => {
    const doc = this.gameDoc();
    const you = this.i18n.t('board.you');
    if (!doc) return you;
    return this.myRole() === 'host' ? doc.hostName : (doc.guestName ?? you);
  });

  protected readonly opponentName = computed(() => {
    const doc = this.gameDoc();
    const opponent = this.i18n.t('board.opponent');
    if (!doc) return opponent;
    return this.myRole() === 'host' ? (doc.guestName ?? opponent) : doc.hostName;
  });

  protected readonly playerPhoto = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    return this.myRole() === 'host' ? doc.hostPhoto : doc.guestPhoto;
  });

  protected readonly opponentPhoto = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    return this.myRole() === 'host' ? doc.guestPhoto : doc.hostPhoto;
  });

  protected readonly playerWand = computed<Wand | null>(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    return this.myRole() === 'host' ? doc.hostWand : doc.guestWand;
  });

  protected readonly opponentWand = computed<Wand | null>(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    return this.myRole() === 'host' ? doc.guestWand : doc.hostWand;
  });

  protected readonly playerTip    = computed(() => this.playerWand()?.tipSlot ?? null);
  protected readonly playerBody   = computed(() => this.playerWand()?.bodySocket ?? null);
  protected readonly playerHandle = computed(() => this.playerWand()?.handleSocket ?? null);

  protected readonly opponentTip    = computed(() => this.opponentWand()?.tipSlot ?? null);
  protected readonly opponentBody   = computed(() => this.opponentWand()?.bodySocket ?? null);
  protected readonly opponentHandle = computed(() => this.opponentWand()?.handleSocket ?? null);

  protected readonly opponentHandRange = computed(() =>
    Array.from({ length: this.opponentHandCount() }, (_, i) => i)
  );

  /** Evita di pianificare più volte lo stesso avanzamento automatico (l'effect sotto può rieseguire per motivi non correlati). */
  private autoAdvanceKey: string | null = null;
  /** Come sopra, ma per l'auto-avanzamento del giocatore reale (vedi effect dedicato nel costruttore) — chiave separata da autoAdvanceKey perché sono due avanzamenti indipendenti (ruoli diversi). */
  private turnAutoAdvanceKey: string | null = null;
  /** Evita di ripianificare la rivelazione del bonus manico se l'effect sotto rieseguisce senza che la coppia pescata sia davvero cambiata. */
  private revealedBonusKey: string | null = null;

  /**
   * Quali fasi si risolvono già da sole (regolamento v2, sez. 4) e quando è il momento di
   * avanzare: Preparazione applica i suoi effetti in modo sincrono dentro `endTurn` (vedi
   * turn-engine.ts), quindi è già pronta appena la si vede; Raccolta aspetta che il giocatore
   * abbia davvero scelto quale carta tenere; Incantesimo è sempre "nessun incantesimo giocato"
   * finché non esisterà un modo per lanciarli; Finale fa scarto+ripesca dentro `endTurn` stesso,
   * al momento dell'avanzamento. Azione resta l'unica manuale (vedi canAdvancePhase).
   */
  private readonly autoAdvanceReady = computed(() => {
    if (!this.isPlayerTurn()) return false;
    switch (this.state()?.phase) {
      case 'preparazione': return true;
      case 'raccolta': return !!this.me()?.hasCollectedThisTurn;
      case 'incantesimo': return true;
      case 'fine': return true;
      default: return false;
    }
  });

  /**
   * Preparazione dà un attimo per notare gli effetti appena risolti (danno da veleno, carte
   * Congelamento sciolte). Finale allunga il ritardo solo se in mano c'è un Residuo in scadenza
   * (Card.expiresAt 'fine'), così l'animazione di sparizione (VANISH_DURATION_MS) ha il tempo di
   * giocare prima che endTurn lo rimuova davvero — altrimenti niente da mostrare, resta rapida.
   */
  private readonly autoAdvanceDelayMs = computed(() => {
    const phase = this.state()?.phase;
    if (phase === 'preparazione') return 2000;
    if (phase === 'fine' && (this.me()?.hand ?? []).some(card => card.expiresAt === 'fine')) return VANISH_DURATION_MS;
    return 500;
  });

  /** Id delle carte "temporanee" ancora presenti in playerHand() ma già in animazione di sparizione (es. Residuo, marcato non appena si programma il ritardo di Finale sopra — vedi l'effect nel costruttore). */
  protected readonly vanishingCardIds = signal<ReadonlySet<string>>(new Set());
  /** Carte "temporanee" già sparite da playerHand() ma non ancora mostrate come tali (es. Congelamento, sciolto in modo atomico dentro l'endTurn dell'avversario — il nostro client la vede già sparita, senza un "prima" da segnare proattivamente) — restano a video come ghost nella loro vecchia posizione finché l'animazione non finisce. */
  protected readonly vanishingGhosts = signal<readonly VanishingGhost[]>([]);
  private lastKnownHand: Card[] = [];

  /** Esplosioni elementali (2.4) risolte in una mano nell'ultimo batch — una entry per ruolo colpito, con le carte vere prese dall'evento (vedi HandExplosion sopra). Popolata dall'effect dedicato sotto, non dal diff di playerHand(): le carte si consumano nella stessa transazione in cui entrano in mano, quindi non compaiono mai in un render precedente da cui poterle dedurre. */
  protected readonly handExplosions = signal<readonly HandExplosion[]>([]);
  /** true per un attimo dopo la comparsa di handExplosions() — pilota il flip di rivelazione (CardComponent.revealed) delle carte coinvolte, invece di mostrarle già scoperte di scatto. */
  protected readonly handExplosionRevealed = signal(false);
  /** Evita di riprocessare due volte lo stesso batch nell'effect dedicato sotto. */
  private lastProcessedHandExplosionBatchId: number | null = null;

  protected readonly playerHandExplosion = computed(() => this.handExplosions().find(e => e.role === this.myRole()) ?? null);
  protected readonly opponentHandExplosion = computed(() => this.handExplosions().find(e => e.role === this.opponentRole()) ?? null);

  /** true per la durata del lampo + scossa quando un'Esplosione elementale (2.4) avviene in Fonte Arcana (danneggia entrambi i giocatori, quindi non è legata a un ruolo). */
  protected readonly fonteExploding = signal(false);
  /** Evita di riprocessare due volte lo stesso batch nell'effect dedicato sotto. */
  private lastProcessedFonteExplosionBatchId: number | null = null;

  constructor() {
    afterNextRender(() => {
      this.observeWidth(this.playerHandTrackRef(), this.playerHandTrackWidth);
      this.observeWidth(this.opponentHandTrackRef(), this.opponentHandTrackWidth);
    });

    // Aiuto di test finché non c'è un vero secondo giocatore: nella partita di debug
    // (guestId 'debug-guest', vedi game.service.ts) nessun client reale guida il turno
    // dell'avversario — senza questo, il turno resterebbe bloccato su 'guest' per sempre.
    // Fa avanzare l'avversario di debug attraverso tutte le fasi (senza raccogliere né
    // combinare nulla) finché il turno non torna al giocatore reale. Da rimuovere/sostituire
    // quando ci sarà un modo vero di testare con due client.
    effect(() => {
      const s = this.state();
      const doc = this.gameDoc();
      if (!s || !doc || doc.guestId !== 'debug-guest' || s.currentTurn !== 'guest') return;

      const key = `${s.turnNumber}:${s.phase}`;
      if (key === this.autoAdvanceKey) return;
      this.autoAdvanceKey = key;

      const gameId = this.gameId();
      const timer = setTimeout(() => void this.gameEngine.advancePhase(gameId, 'guest'), 500);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    });

    // Automazione avanzamento fasi (giocatore reale): Preparazione/Raccolta/Incantesimo/Finale
    // avanzano da sole quando è il tuo turno — vedi autoAdvanceReady sopra per il "quando" di
    // ciascuna. Azione non rientra mai qui: canAdvancePhase la lascia sempre manuale.
    effect(() => {
      if (!this.autoAdvanceReady()) {
        this.turnAutoAdvanceKey = null;
        return;
      }

      const s = this.state();
      const role = this.myRole();
      if (!s || !role) return;

      const key = `${s.turnNumber}:${s.phase}`;
      if (key === this.turnAutoAdvanceKey) return;
      this.turnAutoAdvanceKey = key;

      // Finale: un Residuo in scadenza (Card.expiresAt 'fine') è ancora davvero in mano a questo
      // punto — endTurn non è ancora stato chiamato — quindi lo marchiamo "in sparizione" subito,
      // in parallelo al ritardo appena esteso sopra (autoAdvanceDelayMs), invece di aspettare che
      // sparisca per davvero e animarlo solo a cose fatte. Nessun timer di pulizia qui apposta: lo
      // fa l'effect sotto, quando osserva la rimozione REALE — un timer locale indipendente correva
      // il rischio di ripulire il segnale prima che la scrittura Firestore (rete, quindi più lenta
      // del timer) arrivasse, facendo scambiare l'effect sotto la sparizione per una "sorpresa" e
      // ri-animarla da capo come ghost (il bug della doppia animazione appena osservato in gioco).
      if (s.phase === 'fine') {
        const expiringIds = (this.me()?.hand ?? []).filter(card => card.expiresAt === 'fine').map(card => card.id);
        if (expiringIds.length > 0) {
          this.vanishingCardIds.update(set => new Set([...set, ...expiringIds]));
        }
      }

      const gameId = this.gameId();
      const timer = setTimeout(() => void this.gameEngine.advancePhase(gameId, role), this.autoAdvanceDelayMs());
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    });

    // Carte "temporanee" (Congelamento/Residuo, Card.expiresAt) che spariscono da playerHand() —
    // unico punto che ripulisce vanishingCardIds (niente timer indipendenti altrove, vedi sopra):
    // se una carta sparita era già marcata "in sparizione" (Residuo, marcato proattivamente
    // sopra), l'abbiamo già mostrata/la stiamo mostrando nel loop principale — qui si ripulisce
    // solo il segnale. Se invece sparisce "di sorpresa" (Congelamento, risolto in modo atomico
    // dentro l'endTurn dell'avversario — il nostro client la vede già sparita, mai "prima"),
    // diventa un ghost nella sua vecchia posizione con la stessa animazione.
    effect(() => {
      const current = this.playerHand();
      const previous = this.lastKnownHand;
      this.lastKnownHand = current;
      if (previous.length === 0) return;

      const currentIds = new Set(current.map(card => card.id));
      const goneWithIndex = previous
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => !currentIds.has(card.id));
      if (goneWithIndex.length === 0) return;

      const alreadyShown = this.vanishingCardIds();

      const stillMarkedIds = goneWithIndex.filter(({ card }) => alreadyShown.has(card.id)).map(({ card }) => card.id);
      if (stillMarkedIds.length > 0) {
        this.vanishingCardIds.update(set => {
          const next = new Set(set);
          stillMarkedIds.forEach(id => next.delete(id));
          return next;
        });
      }

      const surprises = goneWithIndex.filter(({ card }) => card.expiresAt && !alreadyShown.has(card.id));
      if (surprises.length === 0) return;

      const total = previous.length;
      const ghosts: VanishingGhost[] = surprises.map(({ card, index }) => ({ card, index, total, kind: 'expiry' as const }));
      this.vanishingGhosts.update(list => [...list, ...ghosts]);

      const ids = surprises.map(({ card }) => card.id);
      const timer = setTimeout(() => {
        this.vanishingGhosts.update(list => list.filter(g => !ids.includes(g.card.id)));
      }, VANISH_DURATION_MS);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    });

    // Esplosione elementale (2.4) in una mano: le carte vere arrivano direttamente dall'evento
    // (ExplosionEvent.cards), non da un diff — vedi il commento su HandExplosion sopra sul perché
    // il diff non può funzionare qui. Rivela le carte con un breve ritardo (handExplosionRevealed)
    // così il flip stesso comunica "ecco cos'è esploso", poi lampo+scossa (stessa animazione CSS
    // della Fonte) e sparizione. Vale sia per la propria mano sia per quella dell'avversario: prima
    // d'ora le carte dell'avversario non erano mai visibili, ora lo sono per questo istante.
    effect(() => {
      const s = this.state();
      if (!s || s.explosionBatchId === this.lastProcessedHandExplosionBatchId) return;
      this.lastProcessedHandExplosionBatchId = s.explosionBatchId;

      const events = s.lastExplosions.filter(e => e.location === 'hand');
      if (events.length === 0) return;

      this.handExplosions.set(events.map(e => ({ role: e.affectedRoles[0], cards: e.cards })));
      this.handExplosionRevealed.set(false);

      const revealTimer = setTimeout(() => this.handExplosionRevealed.set(true), 100);
      this.destroyRef.onDestroy(() => clearTimeout(revealTimer));

      const clearTimer = setTimeout(() => {
        this.handExplosions.set([]);
        this.handExplosionRevealed.set(false);
      }, EXPLOSION_GHOST_DURATION_MS);
      this.destroyRef.onDestroy(() => clearTimeout(clearTimer));
    });

    // Esplosione elementale (2.4) in Fonte Arcana: danneggia entrambi i giocatori, non è legata a
    // singole carte in mano (il template usa track $index sulla riga) — semplificato a un lampo +
    // scossa sull'intera riga invece di un ghost per carta.
    effect(() => {
      const s = this.state();
      if (!s || s.explosionBatchId === this.lastProcessedFonteExplosionBatchId) return;
      this.lastProcessedFonteExplosionBatchId = s.explosionBatchId;
      if (!s.lastExplosions.some(e => e.location === 'fonte')) return;

      this.fonteExploding.set(true);
      const timer = setTimeout(() => this.fonteExploding.set(false), FONTE_EXPLOSION_DURATION_MS);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    });

    // Raccolta: il bonus manico (regolamento 1.4.3, +1 mana permanente) è già risolto nello stato
    // appena le 2 carte vengono pescate — qui lo teniamo solo nascosto in UI per un attimo, cosicché
    // la rivelazione (scale up/down + valore di mana aggiornato) si noti invece di apparire già fatta.
    effect(() => {
      const pair = this.pendingCollect();
      if (!pair) {
        this.revealedBonusKey = null;
        this.revealedBonusIds.set(new Set());
        return;
      }

      const key = `${pair[0].id}:${pair[1].id}`;
      if (key === this.revealedBonusKey) return;
      this.revealedBonusKey = key;
      this.revealedBonusIds.set(new Set());

      const boosted = pair.filter(card => (card.manaBonus ?? 0) > 0).map(card => card.id);
      if (boosted.length === 0) return;

      const timer = setTimeout(() => this.revealedBonusIds.set(new Set(boosted)), 900);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    });
  }

  private observeWidth(ref: ElementRef<HTMLElement> | undefined, target: WritableSignal<number>): void {
    const el = ref?.nativeElement;
    if (!el) return;
    target.set(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => target.set(entry.contentRect.width));
    observer.observe(el);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** Fans hand cards in a light arc: center card highest, outer cards dip lower and rotate outward.
   *  Overlap and arc width are computed from the live container width so any hand size fits without cards disappearing off-screen. */
  protected handCardStyle(index: number, count: number, containerWidth: number, mirrored: boolean): Record<string, string> {
    const spacing = this.handSpacing(count, containerWidth);
    const fanWidth = HAND_ARC_CARD_WIDTH + (count - 1) * spacing;
    const startX = Math.max((containerWidth - fanWidth) / 2, 0);

    const mid = (count - 1) / 2;
    const t = mid > 0 ? (index - mid) / mid : 0;

    const drop = Math.round(Math.abs(t) * HAND_ARC_DROP);
    const rotate = Math.round(t * HAND_ARC_ROTATION_DEG * 10) / 10;

    return {
      left: `${Math.round(startX + index * spacing)}px`,
      transform: `translateY(${mirrored ? -drop : drop}px) rotate(${mirrored ? -rotate : rotate}deg)`,
      'z-index': `${index}`,
    };
  }

  private handSpacing(count: number, containerWidth: number): number {
    if (count <= 1 || containerWidth <= 0) return HAND_ARC_CARD_WIDTH;

    const naturalSpacing = HAND_ARC_CARD_WIDTH * (1 - HAND_MIN_OVERLAP_FRACTION);
    const naturalTotal = HAND_ARC_CARD_WIDTH + (count - 1) * naturalSpacing;
    if (naturalTotal <= containerWidth) return naturalSpacing;

    const fitSpacing = (containerWidth - HAND_ARC_CARD_WIDTH) / (count - 1);
    const minSpacing = HAND_ARC_CARD_WIDTH * (1 - HAND_MAX_OVERLAP_FRACTION);
    return Math.max(fitSpacing, minSpacing);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('gameId') ?? '';
    this.gameId.set(id);

    const unsub = this.game.listenToGame(id, doc => {
      this.gameDoc.set(doc);
      if (doc?.status === 'finished') {
        unsub();
        this.router.navigate(['/result', id]);
      }
    });

    this.destroyRef.onDestroy(() => unsub());
  }

  protected elementColorVar(el: BaseElement): string {
    return `var(--el-${el})`;
  }

  /** Recipe tooltip for an advanced ("Fulmine: Fuoco + Aria") or superior ("Luce: Fuoco + Acqua + Aria + Terra") card — null for base/residium, so the directive stays silent. */
  protected recipeTooltip(el: Element): string | null {
    const recipe = ADVANCED_RECIPES[el as AdvancedElement];
    if (recipe) {
      return this.i18n.t('board.fonte.recipeTooltip', {
        name: this.i18n.elementLabel(el),
        a: this.i18n.elementLabel(recipe[0]),
        b: this.i18n.elementLabel(recipe[1]),
      });
    }

    if (this.isSuperior(el)) {
      return this.i18n.t('board.fonte.recipeTooltipSuperior', {
        name: this.i18n.elementLabel(el),
        formula: this.superiorFormulaLabel(),
      });
    }

    return null;
  }

  /** "Residuo Arcano: Fuoco + Acqua / Aria + Terra" (2.5) — le 2 coppie di elementi base opposti che lo producono. */
  protected readonly residuoTooltip = computed(() =>
    this.i18n.t('board.fonte.residuoTooltip', {
      pairA: `${this.i18n.elementLabel('fire')} + ${this.i18n.elementLabel('water')}`,
      pairB: `${this.i18n.elementLabel('air')} + ${this.i18n.elementLabel('earth')}`,
    }),
  );

  /** Regolamento v2, 2.3/2.4/2.6: scartare le basi corrispondenti (2 per un avanzato, le 4 della formula fissa per un potente) per prendere la carta dalla Fonte. Niente voci fuori da Azione — la ricetta la spiega già il tooltip della carta, un bottone sempre disabilitato non aggiungerebbe nulla. */
  protected fonteMenuItems(el: Element, slotIndex: number): ActionMenuItem[] {
    if (!this.isPlayerTurn() || this.state()?.phase !== 'azione') return [];

    const recipe = ADVANCED_RECIPES[el as AdvancedElement];
    if (recipe) {
      const [a, b] = recipe;
      return [{
        label: this.i18n.t('board.fonte.combineAction', { a: this.i18n.elementLabel(a), b: this.i18n.elementLabel(b) }),
        action: () => this.combineAdvanced(slotIndex, a, b),
        disabled: !this.hasAllBaseCards(recipe),
      }];
    }

    if (this.isSuperior(el)) {
      return [{
        label: this.i18n.t('board.fonte.combineActionSuperior', { formula: this.superiorFormulaLabel() }),
        action: () => this.combineSuperior(slotIndex),
        disabled: !this.hasAllBaseCards(SUPERIOR_FORMULA),
      }];
    }

    return [];
  }

  /** Regolamento 2.5: combina 2 elementi base opposti (o un Residuo al loro posto) per ottenerne uno nuovo dal pool condiviso. Niente voci fuori da Azione, o se il pool è già esaurito per il resto della partita. */
  protected residuoMenuItems(): ActionMenuItem[] {
    if (!this.isPlayerTurn() || this.state()?.phase !== 'azione' || this.residuoDeckCount() === 0) return [];

    const pairs: ReadonlyArray<readonly [BaseElement, BaseElement]> = [['fire', 'water'], ['air', 'earth']];
    return pairs.map(([a, b]) => ({
      label: this.i18n.t('board.fonte.combineAction', { a: this.i18n.elementLabel(a), b: this.i18n.elementLabel(b) }),
      action: () => this.combineResidue(a, b),
      disabled: !this.hasAllBaseCards([a, b]),
    }));
  }

  /** Regolamento 5.2: lancia una carta incantesimo dalla mano — solo in Azione, nel proprio turno. Niente voci per le carte che non sono incantesimi. */
  protected handCardMenuItems(card: Card): ActionMenuItem[] {
    if (card.tier !== 'spell' || !this.isPlayerTurn() || this.state()?.phase !== 'azione') return [];
    const spell = SPELL_CATALOG.find(s => s.id === card.spellId);
    if (!spell) return [];

    const payableHand = this.playerHand().filter(c => c.id !== card.id && c.tier !== 'spell' && c.tier !== 'freeze');
    return [{
      label: this.i18n.t('board.hand.castAction', { name: this.i18n.t(`spells.${spell.id}.name`) }),
      action: () => this.openCastSpellDialog(card, payableHand),
      disabled: computePlayerMana(payableHand) < spell.manaCost,
    }];
  }

  /** Apre il dialog di pagamento e lancia davvero l'incantesimo solo se il giocatore conferma una selezione (annullare chiude senza risultato, vedi CastSpellDialogComponent). */
  protected openCastSpellDialog(card: Card, payableHand: Card[]): void {
    const role = this.myRole();
    if (!role) return;

    this.dialog.open<string[] | undefined, CastSpellDialogData>(CastSpellDialogComponent, {
      data: { spellCard: card, payableHand },
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    }).closed.subscribe(paidCardIds => {
      if (paidCardIds?.length) void this.gameEngine.castSpell(this.gameId(), role, card.id, paidCardIds);
    });
  }

  /** Nome tradotto dell'incantesimo rappresentato da questa carta — stringa vuota se non è (più) una carta incantesimo valida. */
  protected spellName(card: Card): string {
    if (!card.spellId) return '';
    return this.i18n.t(`spells.${card.spellId}.name`);
  }

  /** Solo damage/heal — gli unici 2 SpellEffectType risolti oggi (vedi resolveSpells in turn-engine.ts). Riusa le stesse chiavi i18n del grimorio per restare coerente col testo mostrato lì. */
  protected spellEffectSummary(card: Card): string {
    const spell = SPELL_CATALOG.find(s => s.id === card.spellId);
    if (!spell) return '';
    return spell.effects.map(e => {
      const amount = e.amount ?? 1;
      switch (e.type) {
        case 'damage': return this.i18n.t('grimoire.effects.damage', { amount });
        case 'heal': return this.i18n.t('grimoire.effects.heal', { amount });
        default: return e.type;
      }
    }).join(' ');
  }

  /** null se il dizionario non ha una voce flavorText per questo incantesimo (t() ricade sulla chiave grezza). */
  protected spellFlavor(card: Card): string | null {
    if (!card.spellId) return null;
    const key = `spells.${card.spellId}.flavorText`;
    const text = this.i18n.t(key);
    return text === key ? null : text;
  }

  /** "Resistenza ai danni da Fuoco, vulnerabilità ai danni da Acqua" — or the empty-socket fallback. */
  protected bodyEffectText(el: BaseElement | null): string {
    if (!el) return this.i18n.t('board.wand.bodyEffectEmpty');
    return this.i18n.t('board.wand.bodyEffect', {
      element: this.i18n.elementLabel(el),
      opposite: this.i18n.elementLabel(ELEMENT_OPPOSITES[el]),
    });
  }

  /** "Hai il 20% di possibilità di duplicare Fuoco quando pescato" — or the empty-socket fallback. */
  protected handleEffectText(el: BaseElement | null): string {
    if (!el) return this.i18n.t('board.wand.handleEffectEmpty');
    return this.i18n.t('board.wand.handleEffect', { element: this.i18n.elementLabel(el) });
  }

  /** Un Residuo Arcano in mano vale come un elemento base mancante (2.5) — controllato qui invece che sui soli elementi, dato che serve la carta intera per distinguerlo da una base vera. */
  private hasAllBaseCards(elements: readonly BaseElement[]): boolean {
    const hand = [...this.playerHand()];
    for (const el of elements) {
      // tier === 'base' esclude una carta magia (Card.spellId) che riusa lo stesso elemento solo per la propria arte.
      const exactIndex = hand.findIndex(card => card.element === el && card.tier === 'base');
      if (exactIndex !== -1) {
        hand.splice(exactIndex, 1);
        continue;
      }
      const residueIndex = hand.findIndex(card => card.tier === 'residium');
      if (residueIndex === -1) return false;
      hand.splice(residueIndex, 1);
    }
    return true;
  }

  private isSuperior(el: Element): el is SuperiorElement {
    return el === 'light' || el === 'dark';
  }

  private superiorFormulaLabel(): string {
    return SUPERIOR_FORMULA.map(el => this.i18n.elementLabel(el)).join(' + ');
  }

  protected onFonteHover(el: Element): void {
    const recipe = ADVANCED_RECIPES[el as AdvancedElement];
    if (recipe) {
      this.hoveredRecipe.set({ kind: 'fixed', pair: recipe });
      return;
    }
    this.hoveredRecipe.set(this.isSuperior(el) ? { kind: 'superior' } : null);
  }

  protected onResiduoHover(): void {
    this.hoveredRecipe.set({ kind: 'opposite' });
  }

  protected onFonteHoverEnd(): void {
    this.hoveredRecipe.set(null);
  }

  /** Gold = combo completable right now, blue = part of the recipe but not enough yet, null = unrelated to what's hovered. */
  protected handCardHighlight(el: Element): 'gold' | 'blue' | null {
    const recipe = this.hoveredRecipe();
    if (!recipe) return null;
    // Esclude le carte magia (tier 'spell'): riusano un elemento base solo per la propria arte, non sono una base vera.
    const hand = this.playerHand().filter(card => card.tier === 'base').map(card => card.element);

    if (recipe.kind === 'fixed') {
      const [a, b] = recipe.pair;
      if (el !== a && el !== b) return null;
      return hand.includes(a) && hand.includes(b) ? 'gold' : 'blue';
    }

    if (recipe.kind === 'superior') {
      if (!SUPERIOR_FORMULA.includes(el as BaseElement)) return null;
      return SUPERIOR_FORMULA.every(e => hand.includes(e)) ? 'gold' : 'blue';
    }

    if (!(el in ELEMENT_OPPOSITES)) return null;
    const opposite = ELEMENT_OPPOSITES[el as BaseElement];
    // Un Residuo in mano vale come l'opposto mancante (2.5).
    return (hand.includes(opposite) || hand.includes('residium')) ? 'gold' : 'blue';
  }

  private async combineAdvanced(slotIndex: number, a: BaseElement, b: BaseElement): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    await this.gameEngine.combineElements(this.gameId(), role, slotIndex, a, b);
  }

  private async combineSuperior(slotIndex: number): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    await this.gameEngine.combineSuperior(this.gameId(), role, slotIndex);
  }

  private async combineResidue(a: BaseElement, b: BaseElement): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    await this.gameEngine.combineResidue(this.gameId(), role, a, b);
  }

  /** Fase Raccolta (4.3), primo passo: pesca 2 carte dal mazzo comune (il servizio rimescola se serve). */
  protected async drawTwo(): Promise<void> {
    const role = this.myRole();
    if (!role || !this.canCollect()) return;
    await this.gameEngine.startCollect(this.gameId(), role);
  }

  /** Fase Raccolta (4.3), secondo passo: tieni una delle 2 carte in sospeso. */
  protected async keepCard(kept: Card): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    await this.gameEngine.keepCard(this.gameId(), role, kept.id);
  }

  /** 0 finché il bonus manico di questa carta pescata non è ancora stato rivelato in UI, il valore reale dopo. */
  protected collectCardManaBonus(card: Card): number {
    return this.revealedBonusIds().has(card.id) ? (card.manaBonus ?? 0) : 0;
  }

  /** true nell'istante in cui il bonus manico viene rivelato — pilota l'animazione one-shot sulla carta. */
  protected collectCardRevealing(card: Card): boolean {
    return this.revealedBonusIds().has(card.id);
  }

  /** Avanza la propria fase di turno; da 'fine' passa davvero il turno all'avversario (motore in src/app/game/turn-engine.ts). */
  protected async advancePhase(): Promise<void> {
    const role = this.myRole();
    if (!role || !this.isPlayerTurn()) return;
    await this.gameEngine.advancePhase(this.gameId(), role);
  }

  private topOf(cards: readonly Card[] | undefined): Card | null {
    return cards && cards.length > 0 ? cards[cards.length - 1] : null;
  }

  private hasFreezeCards(player: PlayerState | null | undefined): boolean {
    if (!player) return false;
    return [...player.hand, ...player.deck, ...player.discards].some(card => card.tier === 'freeze');
  }

  protected openGameSettings(): void {
    this.dialog.open(GameSettingsDialogComponent, {
      data: { gameId: this.gameId() },
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openGrimoire(): void {
    this.dialog.open(GrimoireDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openRulebook(): void {
    this.dialog.open(RulebookDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }
}
