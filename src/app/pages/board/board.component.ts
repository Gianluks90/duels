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
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import { GameService } from '../../services/game.service';
import { GameEngineService } from '../../services/game-engine.service';
import { AuthService } from '../../services/auth.service';
import { GameStateService } from '../../services/game-state.service';
import { AnimationQueueService, VANISH_DURATION_MS } from '../../services/animation-queue.service';
import { PinnedSpellsService } from '../../services/pinned-spells.service';
import { CardComponent } from '../../components/card/card.component';
import { DeckComponent } from '../../components/deck/deck.component';
import {
  PlayerHudComponent,
  type PinnedSpellInfo,
} from '../../components/player-hud/player-hud.component';
import { PhaseTrackerComponent } from '../../components/phase-tracker/phase-tracker.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TooltipDirective } from '../../components/ui/tooltip/tooltip.directive';
import {
  ActionMenuComponent,
  type ActionMenuItem,
} from '../../components/ui/action-menu/action-menu.component';
import { GameSettingsDialogComponent } from '../../dialogs/game-settings/game-settings-dialog.component';
import {
  GrimoireDialogComponent,
  type GrimoireDialogData,
} from '../../dialogs/grimoire/grimoire-dialog.component';
import { RulebookDialogComponent } from '../../dialogs/rulebook/rulebook-dialog.component';
import {
  CastSpellDialogComponent,
  type CastSpellDialogData,
  type CastSpellDialogResult,
} from '../../dialogs/cast-spell/cast-spell-dialog.component';
import {
  CombineDialogComponent,
  type CombineDialogData,
} from '../../dialogs/combine/combine-dialog.component';
import {
  SocketDialogComponent,
  type SocketDialogData,
  type SocketTarget,
} from '../../dialogs/socket/socket-dialog.component';
import { PileDialogComponent, type PileDialogData } from '../../dialogs/pile/pile-dialog.component';
import {
  GameLogDialogComponent,
  type GameLogDialogData,
} from '../../dialogs/game-log/game-log-dialog.component';
import type {
  BaseElement,
  Element,
  AdvancedElement,
  SuperiorElement,
} from '../../models/element.model';
import {
  ADVANCED_RECIPES,
  ELEMENT_MANA,
  SUPERIOR_FORMULA,
  elementIconPath,
} from '../../models/element.model';
import type { Wand } from '../../models/wand.model';
import { ELEMENT_OPPOSITES } from '../../models/wand.model';
import type { Card, SpecialMana } from '../../models/card.model';
import { specialManaIconPath, REVEALED_ICON } from '../../models/card.model';
import type { PlayerId, PlayerState } from '../../models/player.model';
import { computePlayerMana } from '../../models/player.model';
import { combineNeedsChoice, countMatchingCards, hasElements } from '../../game/turn-engine';
import { TURN_PHASES, type TurnPhase } from '../../models/turn-phase.model';
import { SPELL_CATALOG } from '../../data/spells';
import type { Spell } from '../../models/spell.model';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { BoardLayoutService } from '../../services/board-layout.service';

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

@Component({
  selector: 'app-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  providers: [GameStateService, AnimationQueueService],
  imports: [
    CardComponent,
    DeckComponent,
    PlayerHudComponent,
    PhaseTrackerComponent,
    IconButtonComponent,
    TooltipDirective,
    ActionMenuComponent,
    TranslatePipe,
    NgTemplateOutlet,
  ],
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.scss', './board-compact.component.scss'],
})
export class BoardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly gameEngine = inject(GameEngineService);
  private readonly gameState = inject(GameStateService);
  private readonly animationQueue = inject(AnimationQueueService);
  private readonly pinnedSpells = inject(PinnedSpellsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  protected readonly i18n = inject(TranslationService);
  private readonly boardLayout = inject(BoardLayoutService);
  protected readonly layoutTier = this.boardLayout.tier;

  protected readonly ELEMENT_OPPOSITES = ELEMENT_OPPOSITES;
  protected readonly ELEMENT_MANA = ELEMENT_MANA;
  protected readonly specialManaIconPath = specialManaIconPath;
  /** CSS mask-image richiede il valore completo `url(...)`, stessa ragione di CardComponent.revealedIconUrl. */
  protected readonly revealedIconUrl = `url(${REVEALED_ICON})`;

  protected readonly wandCardWidth = WAND_CARD_WIDTH;
  private readonly wandPeekCardHeight = Math.round(WAND_CARD_WIDTH * 1.5);
  protected readonly wandLabelHeight = PANEL_HEIGHT;
  protected readonly wandPeekOverlap = this.wandPeekCardHeight - WAND_PEEK_VISIBLE;
  /** Total width of the wand panels — used to keep the hand box clear of them horizontally. */
  protected readonly wandRowWidth = 3 * WAND_CARD_WIDTH + 2 * ROW_GAP;

  /** Gap tra le 3 etichette punta/asta/manico nella striscia bacchetta compatta — deve combaciare
   * col gap reale in board-compact.component.scss, usato qui solo per calcolare compactWandSlotWidth. */
  private readonly COMPACT_WAND_GAP = 4;
  /** Larghezza di fallback prima che compactPlayerWandTrackWidth/compactOpponentWandTrackWidth
   * abbiano una misura reale (primo render) — arbitraria ma ragionevole, sparisce non appena
   * l'effect di osservazione gira la prima volta. */
  private readonly COMPACT_WAND_FALLBACK_WIDTH = 100;
  /** fonteCardWidth (76px, sotto) è tarato sulla larghezza della board desktop — nella zona centrale
   * compatta, molto più stretta, la stessa riga di carte (Residuo/mazzo/griglia/scarti, o mazzo
   * comune+scarti in Raccolta) rischia di non starci e restare ancorata a sinistra invece di
   * centrarsi. Ridotta ma non troppo: .board-compact__fonte ha comunque uno scroll orizzontale di
   * riserva per gli schermi più stretti (vedi board-compact.component.scss). Più grande su tablet
   * (layoutTier 'tablet', 640-1023px): la zona centrale resta a piena larghezza come su mobile (lo
   * stack verticale non cambia, solo il cluster mano+bacchetta diventa una riga), quindi c'è
   * decisamente più spazio orizzontale da sfruttare rispetto a un telefono. */
  protected readonly compactFonteCardWidth = computed(() =>
    this.layoutTier() === 'tablet' ? 96 : 64,
  );
  /** Mazzo avanzato e i suoi scarti, incolonnati invece che affiancati (risparmia larghezza — prima
   * la riga arrivava a coprire i pulsanti Grimorio/Regolamento sui telefoni più larghi, ora spostati
   * nella loro riga fissa, ma la colonna resta comunque comoda su un telefono stretto). Più piccoli
   * di compactFonteCardWidth su mobile apposta: incolonnati raddoppierebbero comunque l'altezza della
   * riga, meglio contenerla piuttosto che sommare due card intere una sopra l'altra. Su tablet invece
   * c'è spazio a sufficienza per tornare alla dimensione "giusta" (la stessa dei mazzi/carte
   * principali) coi rispettivi label, come sul desktop. */
  protected readonly compactFonteStackedCardWidth = computed(() =>
    this.layoutTier() === 'tablet' ? this.compactFonteCardWidth() : 44,
  );
  protected readonly compactFonteStackedShowLabel = computed(() => this.layoutTier() === 'tablet');

  /** Ordine reale delle fasi, 'attesa' esclusa (non è mai il valore persistito, vedi turn-phase.model.ts)
   * — stesso filtro di PhaseTrackerComponent.phases, usato qui solo per calcolare la fase SUCCESSIVA
   * (compactNextPhase sotto), non per uno stepper completo. */
  private readonly compactPhaseOrder: readonly TurnPhase[] = TURN_PHASES.filter(
    (p) => p !== 'attesa',
  );
  /** Fase dopo quella in corso, per il layout compatto tablet (più spazio orizzontale nella
   * phase-bar rispetto a mobile, ci sta anche un'anteprima) — avvolge da 'fine' a 'preparazione'
   * invece di restituire null, riflettendo il vero ciclo del turno (dopo 'fine' si passa
   * all'avversario e si riparte da 'preparazione'). null solo prima che lo stato carichi. */
  protected readonly compactNextPhase = computed<TurnPhase | null>(() => {
    const phase = this.state()?.phase;
    if (!phase) return null;
    const order = this.compactPhaseOrder;
    const index = order.indexOf(phase);
    if (index === -1) return null;
    return order[(index + 1) % order.length];
  });

  protected readonly handCardWidth = HAND_CARD_WIDTH;
  protected readonly handArcCardWidth = HAND_ARC_CARD_WIDTH;
  protected readonly visibleContentHeight = PANEL_CONTENT_HEIGHT;

  /** Mano/mazzo/scarti dell'avversario nel layout compatto, più piccoli di quelli del giocatore
   * (handCardWidth/handArcCardWidth sopra, condivisi col desktop) — le sue carte sono comunque
   * sempre coperte (vedi il fix privacy in board.component.html), non serve leggerle, solo vederle:
   * risparmiare qui altezza verticale aiuta a far stare la Fonte Arcana, molto più ingombrante. */
  protected readonly compactOpponentHandCardWidth = 56;
  protected readonly compactOpponentHandArcCardWidth = 60;

  protected readonly hudWidth = HUD_WIDTH;
  /** Horizontal bounds for the (absolutely positioned) hand box, clear of vita on one side and bacchetta on the other.
   *  Both vita and bacchetta already sit inset by the zone's own padding (--sp-4), so that padding is added back in here
   *  too — otherwise the gap ends up shrunk by that same amount (the bug from the previous pass). */
  protected readonly handBoxHudInset = ZONE_H_PADDING + HUD_WIDTH + GROUP_GAP;
  protected readonly handBoxWandInset = ZONE_H_PADDING + this.wandRowWidth + GROUP_GAP;

  protected readonly fonteCardWidth = FONTE_CARD_WIDTH;
  protected readonly fonteGroupGap = FONTE_GROUP_GAP;

  protected readonly grimoireIcon = '/icons/book_2_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly rulebookIcon =
    '/icons/question_mark_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly gameLogIcon = '/icons/list_alt_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly settingsIcon = '/icons/settings_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  /** Stessa icona teschio usata da player-hud.component per il livello di Avvelenamento (2.3.4) — riusata nel layout compatto, che non passa per PlayerHudComponent. */
  protected readonly poisonIcon = elementIconPath('poison');

  /** Osservati con un effect dedicato (vedi costruttore), non afterNextRender: board.component.html
   * avvolge tutto il layout (desktop e compatto) in un @if (state()), quindi questi elementi non
   * esistono ancora nel DOM finché il primo snapshot Firestore non arriva (o durante il permission-
   * denied di un non-partecipante) — afterNextRender, legato al primissimo render, li mancherebbe
   * per sempre restando a signal(0) (bug reale osservato: arco di mano rimasto largo/non compresso
   * dopo il caricamento). */
  private readonly playerHandTrackRef = viewChild<ElementRef<HTMLElement>>('playerHandTrack');
  private readonly opponentHandTrackRef = viewChild<ElementRef<HTMLElement>>('opponentHandTrack');
  protected readonly playerHandTrackWidth = signal(0);
  protected readonly opponentHandTrackWidth = signal(0);

  /** Stessa idea di playerHandTrackRef/opponentHandTrackRef sopra, ma per la mano sovrapposta del
   * layout compatto (board-compact.component.scss) — elemento diverso, quindi tracciato a parte. */
  private readonly compactPlayerHandTrackRef =
    viewChild<ElementRef<HTMLElement>>('compactPlayerHandTrack');
  private readonly compactOpponentHandTrackRef = viewChild<ElementRef<HTMLElement>>(
    'compactOpponentHandTrack',
  );
  protected readonly compactPlayerHandTrackWidth = signal(0);
  protected readonly compactOpponentHandTrackWidth = signal(0);

  /** Stessa idea di compactPlayerHandTrackRef/compactOpponentHandTrackRef sopra, ma per la striscia
   * bacchetta compatta — serve la sua larghezza reale per far corrispondere la carta infilata alla
   * larghezza della sezione a cui appartiene (compactWandSlotWidth sotto), invece di una stima fissa. */
  private readonly compactPlayerWandTrackRef =
    viewChild<ElementRef<HTMLElement>>('compactPlayerWandTrack');
  private readonly compactOpponentWandTrackRef = viewChild<ElementRef<HTMLElement>>(
    'compactOpponentWandTrack',
  );
  protected readonly compactPlayerWandTrackWidth = signal(0);
  protected readonly compactOpponentWandTrackWidth = signal(0);

  protected readonly gameId = signal<string>('');
  /** Documento Firestore grezzo, alias di GameStateService.gameDoc (scritto da ngOnInit) — il resto
   * della classe continua a leggerlo/scriverlo come un proprio signal, invariato rispetto a prima. */
  protected readonly gameDoc = this.gameState.gameDoc;

  /** Stato di gioco reale, alias di GameStateService.rawState — sempre il valore vero e immediato,
   * mai ritardato: solo AnimationQueueService (sincronizzato da un effect nel costruttore) decide
   * cosa animare a partire dagli stessi cambiamenti, senza mai ritardare questo signal stesso. */
  protected readonly state = this.gameState.rawState;

  /** null sia quando manca doc/uid sia quando l'utente autenticato non è né host né guest di QUESTA partita — chi apre l'URL conoscendo solo il gameId (ma senza esserne parte) non deve essere trattato come guest, vedi il redirect in ngOnInit. */
  private readonly myRole = computed<PlayerId | null>(() => {
    const doc = this.gameDoc();
    const uid = this.auth.user()?.uid;
    if (!doc || !uid) return null;
    if (doc.hostId === uid) return 'host';
    if (doc.guestId === uid) return 'guest';
    return null;
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

  /** Danno subito da mostrare come lampo sulla barra vita — copre qualunque causa TRANNE il veleno
   * (Esplosione elementale, incantesimo), derivato da AnimationQueueService confrontando l'HP tra due
   * GameState consecutivi (vedi deriveGameEvents). Il veleno ha un proprio evento dedicato
   * (playerPoisonDamageEvent/opponentPoisonDamageEvent sotto, icona/colore diversi), scorporato dal
   * danno generico invece di sommarcisi. */
  protected readonly playerDamageEvent = computed(() =>
    this.animationQueue.damageEventFor(this.myRole()),
  );
  protected readonly opponentDamageEvent = computed(() =>
    this.animationQueue.damageEventFor(this.opponentRole()),
  );
  /** Cura ricevuta — stesso schema di playerDamageEvent/opponentDamageEvent. */
  protected readonly playerHealEvent = computed(() =>
    this.animationQueue.healEventFor(this.myRole()),
  );
  protected readonly opponentHealEvent = computed(() =>
    this.animationQueue.healEventFor(this.opponentRole()),
  );
  /** Scudo guadagnato (2.3.3) — solo gli aumenti, vedi derive-events.ts. */
  protected readonly playerShieldEvent = computed(() =>
    this.animationQueue.shieldEventFor(this.myRole()),
  );
  protected readonly opponentShieldEvent = computed(() =>
    this.animationQueue.shieldEventFor(this.opponentRole()),
  );
  /** Danno da Avvelenamento (2.3.4, resolvePreparation) — icona/colore propri (teschio verde) invece
   * del generico lampo rosso, vedi playerDamageEvent sopra sul perché è scorporato. */
  protected readonly playerPoisonDamageEvent = computed(() =>
    this.animationQueue.poisonDamageEventFor(this.myRole()),
  );
  protected readonly opponentPoisonDamageEvent = computed(() =>
    this.animationQueue.poisonDamageEventFor(this.opponentRole()),
  );

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

  /** Stessa matematica di PlayerHudComponent (barra vita desktop) per la barra compatta, che non
   * passa per quel componente (markup proprio, non <app-player-hud>) — normalmente == health.max,
   * la barra si allunga oltre solo quando lo scudo spinge il totale oltre il massimo, così il segmento
   * scudo non viene mai tagliato. */
  private compactHealthTotalUnits(h: { max: number; current: number; shield: number }): number {
    return Math.max(h.max, h.current + h.shield);
  }

  protected compactHpPercent(h: { max: number; current: number; shield: number }): number {
    const pct = (h.current / this.compactHealthTotalUnits(h)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  protected compactShieldPercent(h: { max: number; current: number; shield: number }): number {
    const pct = (h.shield / this.compactHealthTotalUnits(h)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  /** Il numero sopra la barra fonde vita corrente + scudo, come sul desktop (displayedHp). */
  protected compactDisplayedHp(h: { current: number; shield: number }): number {
    return h.current + h.shield;
  }

  /** true finché restano carte Congelamento (2.3.1) non sciolte in circolazione — in mano, mazzo o scarti, non solo in mano. */
  protected readonly playerFrozen = computed(() => this.hasFreezeCards(this.me()));
  protected readonly opponentFrozen = computed(() => this.hasFreezeCards(this.opponentState()));

  protected readonly isPlayerTurn = computed(() => this.state()?.currentTurn === this.myRole());
  /** Numero di turno progressivo (parte da 1) — mostrato dal tracker di fase centrale. */
  protected readonly turnNumber = computed(() => this.state()?.turnNumber ?? 1);
  /** Azione è l'unica fase che non si auto-avanza mai da sola (l'effect nel costruttore gestisce le altre 4) — richiede sempre un input reale del giocatore. */
  protected readonly canAdvancePhase = computed(
    () => this.isPlayerTurn() && this.state()?.phase === 'azione',
  );

  /** Layout compatto (mobile/tablet, board-compact.scss): la zona centrale mostra un solo elemento
   * alla volta invece di tutto insieme — Raccolta durante Preparazione/Raccolta (l'unica fase in cui
   * c'è qualcosa da fare lì), la Fonte Arcana nelle restanti fasi (Azione/Incantesimo/Fine, dove le
   * combinazioni sono l'azione principale). Non dipende da chi ha il turno: la fase è condivisa. */
  protected readonly showRaccolta = computed(() => {
    const phase = this.state()?.phase;
    return phase === 'preparazione' || phase === 'raccolta';
  });

  /** Incantesimi in coda del giocatore di turno (5.2) — pilota i puntini dorati sotto la fase Incantesimo nel tracker. Solo chi ha il turno può averne (si lanciano in Azione, si risolvono in modo sincrono al passaggio in Incantesimo — resolveSpells in turn-engine.ts — quindi non sopravvivono mai oltre la propria Azione). */
  protected readonly currentTurnPendingSpellsCount = computed(() => {
    const s = this.state();
    return s ? s.players[s.currentTurn].pendingSpells.length : 0;
  });

  protected readonly opponentHandCount = computed(() => this.opponentState()?.hand.length ?? 0);
  protected readonly fonteCards = computed<Element[]>(
    () => this.state()?.fonteElementale.map((c) => c.element) ?? [],
  );
  /** Id delle 4 carte della Fonte Arcana, stesso ordine/indice di fonteCards() sopra — serve solo a
   * risalire all'id reale per cardIsDrawing()/cardDrawDelayMs() nel template (fonteCards() porta solo
   * l'Element, non l'intera Card, per tutto il resto che già la usa così). */
  protected readonly fonteCardIds = computed<string[]>(
    () => this.state()?.fonteElementale.map((c) => c.id) ?? [],
  );
  /** Full Card objects (not just Element) so a card carrying a permanent bonus manico (regolamento 1.4.3) still shows its boosted mana value once drawn into hand. */
  protected readonly playerHand = computed<Card[]>(() => this.me()?.hand ?? []);

  /** Set while hovering a Fonte Arcana card or Residuo Arcano — drives the gold/blue highlight on matching hand cards. */
  protected readonly hoveredRecipe = signal<HoverRecipe | null>(null);

  protected readonly residuoDeckCount = computed(() => this.state()?.residiumDeck.length ?? 0);

  protected readonly advancedDeckCount = computed(() => this.state()?.advancedDeck.length ?? 0);
  protected readonly advancedDiscardCount = computed(
    () => this.state()?.advancedDiscards.length ?? 0,
  );
  // Elementi avanzati/potenti non ricevono mai il bonus manico (solo le basi pescate dal mazzo comune, 1.4.3) — nessun topManaBonus qui.
  protected readonly advancedDiscardTop = computed(
    () => this.topOf(this.state()?.advancedDiscards)?.element ?? null,
  );

  protected readonly commonDeckCount = computed(() => this.state()?.commonDeck.length ?? 0);
  protected readonly commonDiscardCount = computed(() => this.state()?.commonDiscards.length ?? 0);
  private readonly commonDiscardTopCard = computed(() => this.topOf(this.state()?.commonDiscards));
  protected readonly commonDiscardTop = computed(
    () => this.commonDiscardTopCard()?.element ?? null,
  );
  protected readonly commonDiscardTopManaBonus = computed(
    () => this.commonDiscardTopCard()?.manaBonus ?? 0,
  );
  /** Mana speciale (3.2): come commonDiscardTopManaBonus, senza questo una carta speciale perde il badge non appena finisce in cima a una pila (stesso bug già visto col bonus manico). */
  protected readonly commonDiscardTopSpecialMana = computed(
    () => this.commonDiscardTopCard()?.specialMana ?? null,
  );

  protected readonly playerDeckCount = computed(() => this.me()?.deck.length ?? 0);
  protected readonly playerDiscardCount = computed(() => this.me()?.discards.length ?? 0);
  private readonly playerDiscardTopCard = computed(() => this.topOf(this.me()?.discards));
  protected readonly playerDiscardTop = computed(
    () => this.playerDiscardTopCard()?.element ?? null,
  );
  protected readonly playerDiscardTopManaBonus = computed(
    () => this.playerDiscardTopCard()?.manaBonus ?? 0,
  );
  protected readonly playerDiscardTopSpecialMana = computed(
    () => this.playerDiscardTopCard()?.specialMana ?? null,
  );
  /** Congelamento (2.3.1): solo gli scarti personali possono averne in cima (applyFreeze in turn-engine.ts scrive solo lì, mai in commonDiscards/advancedDiscards) — senza questo il mazzo mostrerebbe l'arte 'ice' come un normale elemento avanzato, perdendo il tier 'freeze'. */
  protected readonly playerDiscardTopFreeze = computed(
    () => this.playerDiscardTopCard()?.tier === 'freeze',
  );
  protected readonly playerDiscardTopRevealed = computed(
    () => this.playerDiscardTopCard()?.revealedToOpponent ?? false,
  );

  protected readonly opponentDeckCount = computed(() => this.opponentState()?.deck.length ?? 0);
  protected readonly opponentDiscardCount = computed(
    () => this.opponentState()?.discards.length ?? 0,
  );
  private readonly opponentDiscardTopCard = computed(() =>
    this.topOf(this.opponentState()?.discards),
  );
  protected readonly opponentDiscardTop = computed(
    () => this.opponentDiscardTopCard()?.element ?? null,
  );
  protected readonly opponentDiscardTopManaBonus = computed(
    () => this.opponentDiscardTopCard()?.manaBonus ?? 0,
  );
  protected readonly opponentDiscardTopSpecialMana = computed(
    () => this.opponentDiscardTopCard()?.specialMana ?? null,
  );
  protected readonly opponentDiscardTopFreeze = computed(
    () => this.opponentDiscardTopCard()?.tier === 'freeze',
  );
  protected readonly opponentDiscardTopRevealed = computed(
    () => this.opponentDiscardTopCard()?.revealedToOpponent ?? false,
  );

  /** Le 2 carte pescate dal mazzo comune in attesa di scelta — solo locale, nessuna scrittura su Firestore finché non si sceglie quale tenere (regolamento 4.3). */
  protected readonly pendingCollect = computed(() => this.me()?.pendingCollect ?? null);
  /** Id delle carte pescate il cui bonus manico (regolamento 1.4.3) è già stato rivelato in UI — il bonus è già risolto lato stato, ma resta nascosto un attimo per farlo notare (AnimationQueueService, evento collectBonusRevealed). */
  protected readonly revealedBonusIds = this.animationQueue.revealedBonusIds;
  protected readonly canCollect = computed(
    () =>
      this.isPlayerTurn() &&
      this.state()?.phase === 'raccolta' &&
      !this.me()?.hasCollectedThisTurn &&
      !this.pendingCollect(),
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

  /** Snapshot preso al join (GameDoc.hostFavoriteSpellIds/guestFavoriteSpellIds, vedi GameService) —
   * risolto in nomi tradotti per il tooltip reciproco sul player-hud (Qualità della vita). */
  protected readonly playerFavoriteSpellNames = computed<readonly string[]>(() => {
    const doc = this.gameDoc();
    if (!doc) return [];
    const ids = this.myRole() === 'host' ? doc.hostFavoriteSpellIds : doc.guestFavoriteSpellIds;
    return this.resolveSpellNames(ids);
  });

  protected readonly opponentFavoriteSpellNames = computed<readonly string[]>(() => {
    const doc = this.gameDoc();
    if (!doc) return [];
    const ids = this.myRole() === 'host' ? doc.guestFavoriteSpellIds : doc.hostFavoriteSpellIds;
    return this.resolveSpellNames(ids);
  });

  private resolveSpellNames(ids: readonly string[]): string[] {
    return ids
      .map((id) => SPELL_CATALOG.find((s) => s.id === id))
      .filter((s): s is Spell => !!s)
      .map((s) => this.i18n.t(`spells.${s.id}.name`));
  }

  /** Id delle magie pinnate per QUESTA partita (localStorage, vedi PinnedSpellsService) — privato,
   * solo il proprio pannello/badge le mostrano, mai quelli dell'avversario. */
  private readonly pinnedSpellIds = computed<readonly string[]>(() => {
    const id = this.gameId();
    return id ? this.pinnedSpells.pinned(id)() : [];
  });

  /** Elementi richiesti da ALMENO UNA formula pinnata — badge sulle carte Fonte Arcana che servono a
   * crearla (Qualità della vita). */
  protected readonly pinnedElements = computed<ReadonlySet<Element>>(() => {
    const elements = new Set<Element>();
    for (const id of this.pinnedSpellIds()) {
      const spell = SPELL_CATALOG.find((s) => s.id === id);
      spell?.formula.forEach((el) => elements.add(el));
    }
    return elements;
  });

  /** Nome tradotto + formula (elemento per elemento, ciascuno con disponibilità in mano+mazzo+scarti)
   * per ciascuna magia pinnata — passato solo all'app-player-hud proprio (board.component.html).
   * `available` sull'intera magia usa hasElements su quel pool combinato: non "posso lanciarla ORA"
   * (quello richiederebbe la sola mano), ma "ho da qualche parte tutti i pezzi per rifarla". */
  protected readonly playerPinnedSpells = computed<PinnedSpellInfo[]>(() => {
    const ids = this.pinnedSpellIds();
    const player = this.me();
    if (ids.length === 0 || !player) return [];

    const pool = [...player.hand, ...player.deck, ...player.discards];
    return ids
      .map((id) => SPELL_CATALOG.find((s) => s.id === id))
      .filter((s): s is Spell => !!s)
      .map((spell) => ({
        spellId: spell.id,
        name: this.i18n.t(`spells.${spell.id}.name`),
        formula: spell.formula.map((element) => ({
          element,
          available: countMatchingCards(pool, [element]) > 0,
        })),
        available: hasElements(pool, spell.formula),
      }));
  });

  // Letto da state.players[role].wand (GameState, live), non da GameDoc.hostWand/guestWand — quel
  // campo è solo l'istantanea presa al setup (sempre bacchetta vuota, l'input di
  // createInitialGameState), mai più aggiornata in partita. socketElement/holdAtTip/combineElements
  // ecc. mutano solo la copia in state, sia per bodySocket/handleSocket (1.4.2/1.4.3) sia per tipSlot
  // (1.4.1).
  protected readonly playerWand = computed<Wand | null>(() => this.me()?.wand ?? null);

  protected readonly opponentWand = computed<Wand | null>(() => this.opponentState()?.wand ?? null);

  protected readonly playerTip = computed(() => this.playerWand()?.tipSlot ?? null);
  protected readonly playerBody = computed(() => this.playerWand()?.bodySocket ?? null);
  protected readonly playerHandle = computed(() => this.playerWand()?.handleSocket ?? null);

  protected readonly opponentTip = computed(() => this.opponentWand()?.tipSlot ?? null);
  protected readonly opponentBody = computed(() => this.opponentWand()?.bodySocket ?? null);
  protected readonly opponentHandle = computed(() => this.opponentWand()?.handleSocket ?? null);

  /** Dati reali della mano avversaria — il client li ha comunque (l'intero documento Firestore non è protetto per ruolo), erano semplicemente non ancora consultati qui: fino a Terzo occhio/Occhio supremo (Card.revealedToOpponent) non serviva mai sapere quale carta fosse quale, solo quante. */
  protected readonly opponentHand = computed(() => this.opponentState()?.hand ?? []);

  /** Evita di pianificare più volte lo stesso avanzamento automatico (l'effect sotto può rieseguire per motivi non correlati). */
  private autoAdvanceKey: string | null = null;
  /** Come sopra, ma per l'auto-avanzamento del giocatore reale (vedi effect dedicato nel costruttore) — chiave separata da autoAdvanceKey perché sono due avanzamenti indipendenti (ruoli diversi). */
  private turnAutoAdvanceKey: string | null = null;

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
      case 'preparazione':
        return true;
      case 'raccolta':
        return !!this.me()?.hasCollectedThisTurn;
      case 'incantesimo':
        return true;
      case 'fine':
        return true;
      default:
        return false;
    }
  });

  /**
   * Preparazione e Incantesimo danno un attimo per notare gli effetti appena risolti in modo
   * sincrono al solo ingresso in fase (Preparazione: danno da veleno, carte Congelamento sciolte —
   * Incantesimo: resolveSpells applica danno/scudo/rivelazione/ecc. di ogni magia in coda subito
   * dentro advanceTurnPhase, "chi osserva lo stato la vede già risolta", stesso schema — vedi
   * turn-engine.ts). Senza questo, un incantesimo come Terzo occhio risolveva sì correttamente (il
   * flag Card.revealedToOpponent era già impostato) ma il ritardo generico di 500ms sotto lasciava
   * a malapena il tempo al pop CSS di board__hand-card--revealing di partire prima che la fase
   * avanzasse già a Finale — la rivelazione passava semplicemente inosservata. Finale allunga il
   * ritardo solo se in mano c'è un Residuo in scadenza (Card.expiresAt 'fine'), così l'animazione di
   * sparizione (VANISH_DURATION_MS) ha il tempo di giocare prima che endTurn lo rimuova davvero —
   * altrimenti niente da mostrare, resta rapida.
   */
  private readonly autoAdvanceDelayMs = computed(() => {
    const phase = this.state()?.phase;
    if (phase === 'preparazione' || phase === 'incantesimo') return 2000;
    if (phase === 'fine' && (this.me()?.hand ?? []).some((card) => card.expiresAt === 'fine'))
      return VANISH_DURATION_MS;
    return 500;
  });

  /** Ritardo "umano" per fase usato SOLO dal bot di debug (guestId 'debug-guest', vedi l'effect nel
   * costruttore) — indipendente da autoAdvanceDelayMs sopra: quello è tarato sui millisecondi esatti
   * di animazioni specifiche del PROPRIO turno (es. VANISH_DURATION_MS), questo serve solo a far
   * "sembrare che il bot ci pensi" invece di attraversare tutte e 5 le fasi (incluso il fine turno
   * che scarta l'intera mano e ne pesca una fresca) in ~2,5s fissi come prima — troppo rapido per
   * accorgersi di qualunque animazione lato bot (es. Terzo occhio: la carta rivelata sopravvive solo
   * finché il bot non completa il proprio turno). Il bot non decide comunque nulla di concreto (non
   * raccoglie, non combina, non lancia magie — vedi il commento sull'effect stesso), quindi i valori
   * sono arbitrari ma nell'ordine di grandezza di una vera decisione umana. */
  private readonly DEBUG_BOT_PHASE_DELAY_MS: Record<TurnPhase, number> = {
    attesa: 500, // mai davvero raggiunta come fase persistita (turn-phase.model.ts), fallback innocuo
    preparazione: 1200,
    raccolta: 1600,
    azione: 2200,
    incantesimo: 1500,
    fine: 900,
  };

  // I segnali "overlay" sotto (vanishingCardIds/Ghosts, tip/body/handle entering/vanishing,
  // handExplosions, fonteExploding, revealedBonusIds) sono tutti di proprietà di
  // AnimationQueueService, che li deriva confrontando ogni nuovo state() col precedente (vedi
  // deriveGameEvents) — qui solo alias di sola lettura, così il template e il resto della classe
  // restano invariati. tipEntering/tipVanishing/bodyEntering/handleEntering sono filtrati sul
  // proprio ruolo (myRole()): il servizio li tiene per entrambi i giocatori, ma solo il proprio
  // pannello bacchetta li anima, mai quello dell'avversario (vedi board.component.html).
  /** Pesca di carte (Fine turno, Raccolta) — id in finestra d'ingresso → ritardo ms per lo
   * scaglionamento (board__hand-card--drawing), sia per la propria mano sia per quella
   * dell'avversario (dorsi inclusi): a differenza degli overlay bacchetta sopra, qui non c'è
   * bisogno di filtrare per ruolo, il template legge sempre e solo l'id della carta che sta già
   * disegnando (cardIsDrawing/cardDrawDelayMs sotto), mai l'intero segnale. */
  protected cardIsDrawing(cardId: string): boolean {
    return this.animationQueue.isDrawing(cardId);
  }

  protected cardDrawDelayMs(cardId: string): number {
    return this.animationQueue.drawDelayMsFor(cardId);
  }

  protected readonly vanishingCardIds = this.animationQueue.vanishingCardIds;
  protected readonly vanishingGhosts = this.animationQueue.vanishingGhosts;
  protected readonly tipEntering = computed(() =>
    this.animationQueue.tipEnteringFor(this.myRole()),
  );
  protected readonly tipVanishing = computed(() =>
    this.animationQueue.tipVanishingFor(this.myRole()),
  );
  protected readonly bodyEntering = computed(() =>
    this.animationQueue.bodyEnteringFor(this.myRole()),
  );
  protected readonly handleEntering = computed(() =>
    this.animationQueue.handleEnteringFor(this.myRole()),
  );

  /** Esplosioni elementali (2.4) risolte in una mano nell'ultimo batch — una entry per ruolo
   * colpito, con le carte vere prese dall'evento (vedi HandExplosion). */
  protected readonly handExplosions = this.animationQueue.handExplosions;
  /** true per un attimo dopo la comparsa di handExplosions() — pilota SOLO il flip di rivelazione
   * (CardComponent.revealed) delle carte coinvolte, invece di mostrarle già scoperte di scatto. */
  protected readonly handExplosionRevealed = this.animationQueue.handExplosionRevealed;
  /** true a flip concluso — pilota SOLO il lampo/scossa (board__hand-card--exploding), mai in
   * contemporanea al flip (le due animation CSS sullo stesso elemento si sovrascriverebbero a
   * vicenda, vedi AnimationQueueService). */
  protected readonly handExplosionShaking = this.animationQueue.handExplosionShaking;

  protected readonly playerHandExplosion = computed(
    () => this.handExplosions().find((e) => e.role === this.myRole()) ?? null,
  );
  protected readonly opponentHandExplosion = computed(
    () => this.handExplosions().find((e) => e.role === this.opponentRole()) ?? null,
  );

  /** true per la durata del lampo + scossa quando un'Esplosione elementale (2.4) avviene in Fonte
   * Arcana (danneggia entrambi i giocatori, quindi non è legata a un ruolo). */
  protected readonly fonteExploding = this.animationQueue.fonteExploding;

  constructor() {
    // effect (non afterNextRender): l'elemento potrebbe non esistere ancora al primissimo render
    // (vedi il commento su playerHandTrackRef sopra) — l'effect si ri-attiva da solo non appena
    // viewChild() smette di essere undefined (query a segnali, reattiva agli @if/@else). onCleanup
    // scollega l'observer precedente a ogni ri-esecuzione, evitando di accumularne più d'uno sullo
    // stesso elemento.
    effect((onCleanup) => {
      const el = this.playerHandTrackRef()?.nativeElement;
      if (!el) return;
      this.playerHandTrackWidth.set(el.clientWidth);
      const observer = new ResizeObserver(([entry]) =>
        this.playerHandTrackWidth.set(entry.contentRect.width),
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
    effect((onCleanup) => {
      const el = this.opponentHandTrackRef()?.nativeElement;
      if (!el) return;
      this.opponentHandTrackWidth.set(el.clientWidth);
      const observer = new ResizeObserver(([entry]) =>
        this.opponentHandTrackWidth.set(entry.contentRect.width),
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    // Come sopra, ma per la mano sovrapposta del layout compatto (@else in board.component.html).
    effect((onCleanup) => {
      const el = this.compactPlayerHandTrackRef()?.nativeElement;
      if (!el) return;
      this.compactPlayerHandTrackWidth.set(el.clientWidth);
      const observer = new ResizeObserver(([entry]) =>
        this.compactPlayerHandTrackWidth.set(entry.contentRect.width),
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
    effect((onCleanup) => {
      const el = this.compactOpponentHandTrackRef()?.nativeElement;
      if (!el) return;
      this.compactOpponentHandTrackWidth.set(el.clientWidth);
      const observer = new ResizeObserver(([entry]) =>
        this.compactOpponentHandTrackWidth.set(entry.contentRect.width),
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
    effect((onCleanup) => {
      const el = this.compactPlayerWandTrackRef()?.nativeElement;
      if (!el) return;
      this.compactPlayerWandTrackWidth.set(el.clientWidth);
      const observer = new ResizeObserver(([entry]) =>
        this.compactPlayerWandTrackWidth.set(entry.contentRect.width),
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
    effect((onCleanup) => {
      const el = this.compactOpponentWandTrackRef()?.nativeElement;
      if (!el) return;
      this.compactOpponentWandTrackWidth.set(el.clientWidth);
      const observer = new ResizeObserver(([entry]) =>
        this.compactOpponentWandTrackWidth.set(entry.contentRect.width),
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });

    // Aiuto di test finché non c'è un vero secondo giocatore: nella partita di debug
    // (guestId 'debug-guest', vedi game.service.ts) nessun client reale guida il turno
    // dell'avversario — senza questo, il turno resterebbe bloccato su 'guest' per sempre.
    // Fa avanzare l'avversario di debug attraverso tutte le fasi (senza raccogliere né
    // combinare nulla) finché il turno non torna al giocatore reale, con un ritardo per fase
    // "umano" (DEBUG_BOT_PHASE_DELAY_MS sopra) invece di un valore fisso a raffica — così c'è
    // il tempo di notare cosa succede nel suo turno (es. una carta appena rivelata con Terzo
    // Occhio) prima che lo attraversi tutto e lo chiuda. Da rimuovere/sostituire quando ci sarà
    // un modo vero di testare con due client.
    effect(() => {
      const s = this.state();
      const doc = this.gameDoc();
      if (!s || !doc || doc.guestId !== 'debug-guest' || s.currentTurn !== 'guest') return;

      const key = `${s.turnNumber}:${s.phase}`;
      if (key === this.autoAdvanceKey) return;
      this.autoAdvanceKey = key;

      const gameId = this.gameId();
      const timer = setTimeout(
        () => void this.gameEngine.advancePhase(gameId, 'guest'),
        this.DEBUG_BOT_PHASE_DELAY_MS[s.phase],
      );
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
        const expiringIds = (this.me()?.hand ?? [])
          .filter((card) => card.expiresAt === 'fine')
          .map((card) => card.id);
        if (expiringIds.length > 0) {
          this.animationQueue.markExpiringSoon(expiringIds);
        }
      }

      const gameId = this.gameId();
      const timer = setTimeout(
        () => void this.gameEngine.advancePhase(gameId, role),
        this.autoAdvanceDelayMs(),
      );
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    });

    // Tutte le animazioni/fx derivate da un cambio di stato (carte scadute sparite dalla mano,
    // Esplosioni elementali, bacchetta, bonus manico rivelato, suoni di pesca/rivelazione Fonte,
    // flash danno) sono centralizzate in AnimationQueueService: ogni nuovo state() grezzo viene
    // confrontato col precedente (deriveGameEvents) e tradotto negli overlay effimeri esposti sopra
    // (vanishingGhosts, handExplosions, tipEntering, ecc.), invece di 9 effect separati con un
    // proprio "lastKnownX" mutabile ciascuno.
    effect(() => {
      const raw = this.state();
      if (raw) this.animationQueue.sync(raw, this.myRole());
    });
  }

  /** Fans hand cards in a light arc: center card highest, outer cards dip lower and rotate outward.
   *  Overlap and arc width are computed from the live container width so any hand size fits without cards disappearing off-screen. */
  protected handCardStyle(
    index: number,
    count: number,
    containerWidth: number,
    mirrored: boolean,
  ): Record<string, string> {
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

  /** Stessa idea di handCardStyle/handSpacing sopra (l'overlap si stringe quanto serve perché
   * l'intera mano stia in containerWidth, mai una fila che scappa fuori schermo), ma per la mano
   * SOVRAPPOSTA del layout compatto — niente rotazione/caduta ad arco (board-compact vuole carte
   * vere in riga dritta, non un ventaglio), e position: absolute con uno z-index esplicito per
   * ciascuna, invece di affidarsi all'ordine naturale del DOM (che con app-action-menu di mezzo
   * non garantiva uno stacking corretto dei badge sulle carte sovrapposte). cardWidth è un parametro
   * (a differenza di handSpacing sopra, che usa sempre HAND_ARC_CARD_WIDTH) perché qui la mano
   * dell'avversario usa una dimensione più piccola di quella del giocatore. */
  protected compactHandCardStyle(
    index: number,
    count: number,
    containerWidth: number,
    cardWidth: number,
  ): Record<string, string> {
    const spacing = this.compactHandSpacing(count, containerWidth, cardWidth);
    // Stesso centraggio di handCardStyle sopra (startX): senza, la mano restava sempre ancorata al
    // bordo sinistro del proprio spazio invece di stare centrata quando non lo riempie per intero
    // (poche carte, o spacing "a riposo" già sotto la larghezza disponibile).
    const fanWidth = cardWidth + (count - 1) * spacing;
    const startX = Math.max((containerWidth - fanWidth) / 2, 0);
    return {
      position: 'absolute',
      left: `${Math.round(startX + index * spacing)}px`,
      top: '0',
      'z-index': `${index}`,
    };
  }

  /** Stessa idea di handSpacing sopra, parametrizzata su cardWidth invece di HAND_ARC_CARD_WIDTH
   * fisso — serve a compactHandCardStyle, che deve gestire sia la mano del giocatore (100px) sia
   * quella, più piccola, dell'avversario (60px). */
  private compactHandSpacing(count: number, containerWidth: number, cardWidth: number): number {
    if (count <= 1 || containerWidth <= 0) return cardWidth;

    const naturalSpacing = cardWidth * (1 - HAND_MIN_OVERLAP_FRACTION);
    const naturalTotal = cardWidth + (count - 1) * naturalSpacing;
    if (naturalTotal <= containerWidth) return naturalSpacing;

    const fitSpacing = (containerWidth - cardWidth) / (count - 1);
    const minSpacing = cardWidth * (1 - HAND_MAX_OVERLAP_FRACTION);
    return Math.max(fitSpacing, minSpacing);
  }

  /** Larghezza della carta infilata dietro punta/asta/manico nel layout compatto — deve corrispondere
   * a quella reale della sua sezione (un terzo della striscia, al netto dei 2 gap tra le 3 etichette),
   * non una stima fissa. trackWidth 0 (primo render, prima che l'effect di osservazione giri) ricade
   * su COMPACT_WAND_FALLBACK_WIDTH invece di un risultato negativo/assurdo. */
  protected compactWandSlotWidth(trackWidth: number): number {
    if (trackWidth <= 0) return this.COMPACT_WAND_FALLBACK_WIDTH;
    return Math.max(1, Math.floor((trackWidth - 2 * this.COMPACT_WAND_GAP) / 3));
  }

  /** Larghezza della carta incastonata/trattenuta col suo header (icona+nome, [header]="true" — la
   * label della sezione, "Punta"/"Asta"/"Manico", resta a parte, libera in alto a sinistra nel 20%
   * riservato a lei, vedi il template) su una sezione, layout tablet. Lì la striscia è una colonna
   * di 3 sezioni: trackWidth è la larghezza dell'INTERA colonna (non va divisa per 3 come in
   * compactWandSlotWidth sopra, pensata per la striscia orizzontale mobile). Piena larghezza
   * disponibile (80% della colonna, il restante 20% è della label) — l'header (icona+nome) ha
   * bisogno di spazio per restare leggibile, non va ridotto per stare nell'altezza. L'altezza
   * massima del CONTENITORE (non della carta, che resta a piena larghezza/proporzione) è imposta a
   * livello CSS con overflow: hidden su .board-compact__wand-slot--overlay — l'eventuale eccedenza
   * verticale viene ritagliata, non l'intera carta rimpicciolita. */
  protected compactWandOverlayCardWidth(trackWidth: number): number {
    if (trackWidth <= 0) return this.COMPACT_WAND_FALLBACK_WIDTH;
    return Math.max(1, Math.floor(trackWidth * 0.8));
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('gameId') ?? '';
    this.gameId.set(id);

    const unsub = this.game.listenToGame(
      id,
      (doc) => {
        this.gameDoc.set(doc);
        if (doc?.status === 'finished') {
          unsub();
          // Magie pinnate (Qualità della vita): promemoria legato a QUESTA partita, non deve
          // ricomparire alla prossima (vedi PinnedSpellsService.clear).
          this.pinnedSpells.clear(id);
          this.router.navigate(['/result', id]);
          return;
        }
        // Regole Firestore già negano lettura/scrittura a chi non è host/guest di QUESTA partita
        // (games/{gameId}) — questo redirect copre il caso limite in cui `doc` arriva comunque
        // (es. partita ancora 'waiting', leggibile da chiunque per permettere il join by code) ma
        // l'utente autenticato non vi appartiene, invece di lasciarlo su una board vuota/rotta.
        const uid = this.auth.user()?.uid;
        if (doc && uid && doc.hostId !== uid && doc.guestId !== uid) {
          unsub();
          this.router.navigate(['/home']);
        }
      },
      () => this.router.navigate(['/home']),
    );

    this.destroyRef.onDestroy(() => unsub());
  }

  protected elementColorVar(el: BaseElement): string {
    return `var(--el-${el})`;
  }

  /** Solo la formula ("Fuoco + Aria" per un avanzato, la formula fissa per un potente) — il nome e il valore in mana si mostrano a parte nel tooltip ricco della Fonte Arcana (board.component.html, ng-template #recipeTip). Stringa vuota per base/residium (mai il caso qui: fonteCards() contiene solo avanzati/potenti). */
  protected recipeFormula(el: Element): string {
    const recipe = ADVANCED_RECIPES[el as AdvancedElement];
    if (recipe)
      return `${this.i18n.elementLabel(recipe[0])} + ${this.i18n.elementLabel(recipe[1])}`;
    if (this.isSuperior(el)) return this.superiorFormulaLabel();
    return '';
  }

  /** Regolamento v2, 2.3/2.4/2.6: scartare le basi corrispondenti (2 per un avanzato, le 4 della formula fissa per un potente) per prendere la carta dalla Fonte. Niente voci fuori da Azione — la ricetta la spiega già il tooltip della carta, un bottone sempre disabilitato non aggiungerebbe nulla. */
  protected fonteMenuItems(el: Element, slotIndex: number): ActionMenuItem[] {
    if (!this.isPlayerTurn() || this.state()?.phase !== 'azione') return [];

    const recipe = ADVANCED_RECIPES[el as AdvancedElement];
    if (recipe) {
      const [a, b] = recipe;
      return [
        {
          label: this.i18n.t('board.fonte.combineAction', {
            a: this.i18n.elementLabel(a),
            b: this.i18n.elementLabel(b),
          }),
          action: () => this.combineAdvanced(slotIndex, a, b),
          disabled: !this.hasAllBaseCards(recipe),
        },
      ];
    }

    if (this.isSuperior(el)) {
      return [
        {
          label: this.i18n.t('board.fonte.combineActionSuperior', {
            formula: this.superiorFormulaLabel(),
          }),
          action: () => this.combineSuperior(slotIndex),
          disabled: !this.hasAllBaseCards(SUPERIOR_FORMULA),
        },
      ];
    }

    return [];
  }

  /** Regolamento 2.5: combina 2 elementi base opposti (o un Residuo al loro posto) per ottenerne uno nuovo dal pool condiviso. Niente voci fuori da Azione, o se il pool è già esaurito per il resto della partita. */
  protected residuoMenuItems(): ActionMenuItem[] {
    if (!this.isPlayerTurn() || this.state()?.phase !== 'azione' || this.residuoDeckCount() === 0)
      return [];

    const pairs: ReadonlyArray<readonly [BaseElement, BaseElement]> = [
      ['fire', 'water'],
      ['air', 'earth'],
    ];
    return pairs.map(([a, b]) => ({
      label: this.i18n.t('board.fonte.combineAction', {
        a: this.i18n.elementLabel(a),
        b: this.i18n.elementLabel(b),
      }),
      action: () => this.combineResidue(a, b),
      disabled: !this.hasAllBaseCards([a, b]),
    }));
  }

  /** Regolamento 5.2 (incantesimi) / 1.4.1-4.4 (punta della bacchetta) — le uniche 2 azioni disponibili da un menu su una carta in mano, mai insieme (una carta è o un incantesimo o una base, mai entrambe). Niente voci fuori da Azione/dal proprio turno, o per tier non pertinenti (avanzato/potente/Residuo/Congelamento non hanno azioni qui). */
  protected handCardMenuItems(card: Card, index: number): ActionMenuItem[] {
    if (!this.isPlayerTurn() || this.state()?.phase !== 'azione') return [];

    if (card.tier === 'spell') {
      const spell = SPELL_CATALOG.find((s) => s.id === card.spellId);
      if (!spell) return [];

      // Include l'eventuale carta trattenuta nella punta della bacchetta (1.4.1) — conta come se
      // fosse ancora in mano, quindi anche come mana pagabile per un incantesimo.
      const tip = this.playerTip();
      const payableHand = [...this.playerHand(), ...(tip ? [tip] : [])].filter(
        (c) => c.id !== card.id && c.tier !== 'spell' && c.tier !== 'freeze',
      );
      return [
        {
          label: this.i18n.t('board.hand.castAction', {
            name: this.i18n.t(`spells.${spell.id}.name`),
          }),
          action: () => this.openCastSpellDialog(card, payableHand, tip?.id ?? null),
          disabled: computePlayerMana(payableHand) < spell.manaCost,
        },
      ];
    }

    if (card.tier === 'base') {
      return [
        {
          label: this.i18n.t('board.hand.holdAtTipAction'),
          action: () => this.holdAtTip(card, index),
          disabled: !!this.playerWand()?.tipSlot || !!this.me()?.tipHeldAtPreparation,
        },
        {
          label: this.i18n.t('board.hand.socketAction'),
          action: () => this.openSocketDialog(card, index),
          disabled: !!this.playerBody() && !!this.playerHandle(),
        },
      ];
    }

    return [];
  }

  /** Apre il dialog di pagamento (ed eventuale scelta del bersaglio, es. Migliora mana) e lancia davvero l'incantesimo solo se il giocatore conferma (annullare chiude senza risultato, vedi CastSpellDialogComponent). */
  protected openCastSpellDialog(card: Card, payableHand: Card[], tipCardId: string | null): void {
    const role = this.myRole();
    if (!role) return;

    this.dialog
      .open<CastSpellDialogResult | undefined, CastSpellDialogData>(CastSpellDialogComponent, {
        data: {
          spellCard: card,
          payableHand,
          tipCardId,
          discards: this.me()?.discards ?? [],
        },
        positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        panelClass: 'dialog-panel',
      })
      .closed.subscribe((result) => {
        if (result)
          void this.gameEngine.castSpell(
            this.gameId(),
            role,
            card.id,
            result.paidCardIds,
            result.targetCardId,
            result.targetCardIds,
          );
      });
  }

  /** Regolamento 1.4.1/4.4: trattiene una carta base dalla mano nella punta della bacchetta — l'animazione di uscita dalla mano riusa lo stesso meccanismo/aspetto del Residuo in scadenza (AnimationQueueService.addVanishingGhost, kind 'toTip'), quella d'ingresso nel pannello punta è pilotata da AnimationQueueService in risposta al wandTipFilled event (tipEntering). */
  protected holdAtTip(card: Card, index: number): void {
    const role = this.myRole();
    if (!role) return;

    const total = this.playerHand().length;
    this.animationQueue.addVanishingGhost({ card, index, total, kind: 'toTip' });

    void this.gameEngine.holdAtTip(this.gameId(), role, card.id);
  }

  /** Regolamento 1.4.2/1.4.3/4.4: apre la dialog di scelta asta/manico per una carta base dalla mano — applica la scelta solo se il giocatore conferma (annullare chiude senza risultato, vedi SocketDialogComponent). Il cast a BaseElement è sicuro: questa azione compare solo per card.tier === 'base' (handCardMenuItems). L'animazione di uscita dalla mano riusa lo stesso meccanismo/aspetto della punta (AnimationQueueService.addVanishingGhost, kind 'toSocket'), quella d'ingresso nel pannello asta/manico è pilotata da AnimationQueueService in risposta al wandSocketFilled event (bodyEntering/handleEntering). */
  protected openSocketDialog(card: Card, index: number): void {
    const role = this.myRole();
    if (!role) return;

    this.dialog
      .open<SocketTarget | undefined, SocketDialogData>(SocketDialogComponent, {
        data: {
          element: card.element as BaseElement,
          bodySocket: this.playerBody(),
          handleSocket: this.playerHandle(),
        },
        positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        panelClass: 'dialog-panel',
      })
      .closed.subscribe((target) => {
        if (!target) return;

        const total = this.playerHand().length;
        this.animationQueue.addVanishingGhost({ card, index, total, kind: 'toSocket' });

        void this.gameEngine.socketElement(this.gameId(), role, card.id, target);
      });
  }

  /** Nome tradotto dell'incantesimo rappresentato da questa carta — stringa vuota se non è (più) una carta incantesimo valida. */
  protected spellName(card: Card): string {
    if (!card.spellId) return '';
    return this.i18n.t(`spells.${card.spellId}.name`);
  }

  /** Copre tutti gli SpellEffectType risolti oggi in applySpellEffect (vedi resolveSpells in turn-engine.ts) — non necessariamente tutti quelli che questo switch sa comunque tradurre in testo. Riusa le stesse chiavi i18n del grimorio per restare coerente col testo mostrato lì. */
  protected spellEffectSummary(card: Card): string {
    const spell = SPELL_CATALOG.find((s) => s.id === card.spellId);
    if (!spell) return '';
    return spell.effects
      .map((e) => {
        const amount = e.amount ?? 1;
        switch (e.type) {
          case 'damage':
            return spell.element
              ? this.i18n.t('grimoire.effects.damageElement', {
                  amount,
                  element: this.i18n.elementLabel(spell.element),
                })
              : this.i18n.t('grimoire.effects.damage', { amount });
          case 'damage_ignore_shields':
            return this.i18n.t('grimoire.effects.damageIgnoreShields', { amount });
          case 'damage_self':
            return spell.element
              ? this.i18n.t('grimoire.effects.damageSelfElement', {
                  amount,
                  element: this.i18n.elementLabel(spell.element),
                })
              : this.i18n.t('grimoire.effects.damageSelf', { amount });
          case 'damage_halve_opponent':
            return this.i18n.t('grimoire.effects.damageHalveOpponent');
          case 'damage_from_fonte':
            return this.i18n.t('grimoire.effects.damageFromFonte');
          case 'heal':
            return this.i18n.t('grimoire.effects.heal', { amount });
          case 'shield_add':
            return this.i18n.t('grimoire.effects.shieldAdd', { amount });
          case 'shield_remove_opponent':
            return e.amount !== undefined
              ? this.i18n.t('grimoire.effects.shieldRemoveOpponent', { amount: e.amount })
              : this.i18n.t('grimoire.effects.shieldRemoveOpponentAll');
          case 'poison_add':
            return this.i18n.t('grimoire.effects.poisonAdd', { amount });
          case 'ice_add':
            return this.i18n.t('grimoire.effects.iceAdd', { amount });
          case 'poison_clear_self':
            return this.i18n.t('grimoire.effects.poisonClearSelf');
          case 'ice_clear_self':
            return this.i18n.t('grimoire.effects.iceClearSelf');
          case 'opponent_discard_random':
            return this.i18n.t('grimoire.effects.opponentDiscardRandom', { amount });
          case 'opponent_discard_hand':
            return this.i18n.t('grimoire.effects.opponentDiscardHand');
          case 'reveal_opponent_hand':
            if (e.cardTierFilter === 'spell') {
              return e.amount !== undefined
                ? this.i18n.t('grimoire.effects.revealOpponentHandRandomSpell', {
                    amount: e.amount,
                  })
                : this.i18n.t('grimoire.effects.revealOpponentHandSpell');
            }
            return e.amount !== undefined
              ? this.i18n.t('grimoire.effects.revealOpponentHandRandom', { amount: e.amount })
              : this.i18n.t('grimoire.effects.revealOpponentHand');
          case 'fonte_reset':
            return this.i18n.t('grimoire.effects.fonteReset');
          case 'boost_card_mana':
            return this.i18n.t('grimoire.effects.boostCardMana', { amount });
          case 'consume_discards':
            return e.consumableCardTiers?.includes('spell')
              ? this.i18n.t('grimoire.effects.consumeDiscardsExtended', { amount })
              : this.i18n.t('grimoire.effects.consumeDiscards', { amount });
          default:
            return e.type;
        }
      })
      .join(' ');
  }

  /** null se il dizionario non ha una voce flavorText per questo incantesimo (t() ricade sulla chiave grezza). */
  protected spellFlavor(card: Card): string | null {
    if (!card.spellId) return null;
    const key = `spells.${card.spellId}.flavorText`;
    const text = this.i18n.t(key);
    return text === key ? null : text;
  }

  /** Spiegazione testuale dell'effetto del mana speciale (3.2) — tooltip su una carta che lo porta, dato che il solo badge/aria-label non lo spiega a chi non conosce già la regola. */
  protected specialManaEffectText(type: SpecialMana): string {
    return this.i18n.t(`card.specialManaEffect.${type}`);
  }

  /** Quali dei tooltip ricchi (spell/freeze/mana accumulato/mana speciale/Occhio) si applicano a questa carta — al massimo 2 nella pratica (un tier è sempre uno solo, specialMana esiste solo su tier 'base'; revealedToOpponent (5.x) è l'unico che può combinarsi con qualunque altro). Usata sia per decidere se mostrare #cardTip sia per capire se serve il layout "multiplo" (vedi isMultiCardTooltip). */
  protected cardTooltipFlags(card: Card): boolean[] {
    return [
      card.tier === 'spell',
      card.tier === 'freeze',
      card.tier === 'mana',
      !!card.specialMana,
      !!card.revealedToOpponent,
    ];
  }

  protected hasCardTooltip(card: Card): boolean {
    return this.cardTooltipFlags(card).some(Boolean);
  }

  protected isMultiCardTooltip(card: Card): boolean {
    return this.cardTooltipFlags(card).filter(Boolean).length > 1;
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

  /** Un Residuo Arcano in mano vale come un elemento base mancante (2.5) — controllato qui invece che sui soli elementi, dato che serve la carta intera per distinguerlo da una base vera. Include anche l'eventuale carta trattenuta nella punta della bacchetta (1.4.1): conta come se fosse ancora in mano. */
  private hasAllBaseCards(elements: readonly BaseElement[]): boolean {
    const tip = this.playerTip();
    const hand = tip ? [...this.playerHand(), tip] : this.playerHand();
    return hasElements(hand, elements);
  }

  private isSuperior(el: Element): el is SuperiorElement {
    return el === 'light' || el === 'dark';
  }

  private superiorFormulaLabel(): string {
    return SUPERIOR_FORMULA.map((el) => this.i18n.elementLabel(el)).join(' + ');
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

  /**
   * Gold = combo completabile subito, blue = ne fa parte ma non basta ancora, null = non c'entra con
   * quanto in hover. Considera anche un eventuale Residuo Arcano in mano come sostituto jolly per
   * l'elemento mancante (2.5) — sia per continuare a evidenziare le basi esatte (il Residuo può
   * coprire un buco altrove nella stessa formula) sia per evidenziare il Residuo stesso quando è lui
   * a completarla. Bug fix: prima filtrava via ogni carta non-base ancora prima di guardarla, quindi
   * un Residuo in mano non veniva mai considerato, né qui né dal chiamante nel template.
   */
  protected handCardHighlight(card: Card): 'gold' | 'blue' | null {
    const recipe = this.hoveredRecipe();
    if (!recipe || (card.tier !== 'base' && card.tier !== 'residium')) return null;

    const hand = this.playerHand();
    const tip = this.playerTip();
    // Esclude le carte magia (tier 'spell'): riusano un elemento base solo per la propria arte, non sono una base vera.
    // Include l'eventuale carta trattenuta nella punta della bacchetta (1.4.1): conta come se fosse ancora in mano.
    const baseElements = hand
      .filter((c) => c.tier === 'base')
      .map((c) => c.element)
      .concat(tip ? [tip.element] : []);
    const residuoCount = hand.filter((c) => c.tier === 'residium').length;

    const requiredSets: ReadonlyArray<readonly BaseElement[]> =
      recipe.kind === 'fixed'
        ? [recipe.pair]
        : recipe.kind === 'superior'
          ? [SUPERIOR_FORMULA]
          : [
              ['fire', 'water'],
              ['air', 'earth'],
            ]; // 'opposite' (hover sul Residuo): le 2 coppie che possono produrne uno nuovo

    let best: 'gold' | 'blue' | null = null;
    for (const required of requiredSets) {
      const missing = required.filter((e) => !baseElements.includes(e)).length;
      // Una base esatta è rilevante solo se fa parte di QUESTA formula; un Residuo lo è solo se serve
      // davvero a colmare un buco (altrimenti la formula si completa già senza toccarlo).
      const relevant =
        card.tier === 'residium' ? missing > 0 : required.includes(card.element as BaseElement);
      if (!relevant) continue;

      if (missing <= residuoCount) return 'gold'; // il massimo possibile, nessun bisogno di continuare
      best = 'blue';
    }
    return best;
  }

  private async combineAdvanced(slotIndex: number, a: BaseElement, b: BaseElement): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    const chosenIds = await this.resolveCombineChoice([a, b]);
    if (chosenIds === null) return;
    await this.gameEngine.combineElements(this.gameId(), role, slotIndex, a, b, chosenIds);
  }

  private async combineSuperior(slotIndex: number): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    const chosenIds = await this.resolveCombineChoice(SUPERIOR_FORMULA);
    if (chosenIds === null) return;
    await this.gameEngine.combineSuperior(this.gameId(), role, slotIndex, chosenIds);
  }

  private async combineResidue(a: BaseElement, b: BaseElement): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    const chosenIds = await this.resolveCombineChoice([a, b]);
    if (chosenIds === null) return;
    await this.gameEngine.combineResidue(this.gameId(), role, a, b, chosenIds);
  }

  /**
   * Se per uno o più degli elementi richiesti c'è una scelta reale da fare (`combineNeedsChoice`:
   * più copie esatte con almeno una preziosa, o una base esatta e un Residuo entrambi disponibili),
   * apre `CombineDialogComponent` e aspetta la scelta dell'utente prima di procedere — altrimenti
   * torna subito una mappa vuota, così la combinazione avviene senza alcuna interruzione come sempre
   * (la scelta automatica in `turn-engine.ts` resta l'unica candidata comunque). Torna `null` se
   * l'utente annulla la dialog (nessuna combinazione da fare).
   *
   * Bug corretto: un elemento SENZA copia esatta in mano dipende per forza dal Residuo Arcano, e
   * `combineNeedsChoice` lo giudica "senza ambiguità" (non c'è scelta da fare, l'unica fonte è il
   * Residuo) — quindi restava fuori da `ambiguous` e dal dialog. Se però il dialog si apriva comunque
   * per un ALTRO elemento della stessa formula che aveva sia una copia esatta sia il Residuo
   * disponibili (es. Terra esatta + Residuo, per una formula Fuoco+Terra senza Fuoco in mano),
   * scegliere lì il Residuo per quell'altro elemento consumava la stessa copia che l'elemento senza
   * copia esatta stava per prendere automaticamente — la combinazione falliva in silenzio (il
   * Residuo, già speso nel primo passaggio della combinazione, non c'era più per il secondo). Ora
   * ogni elemento "costretto" al Residuo entra comunque nel dialog (come riga con un'unica opzione,
   * il Residuo stesso) ogni volta che il dialog si apre per qualunque motivo — così `isTaken` nel
   * dialog vede ed esclude correttamente quella copia dalle altre righe, invece di lasciarla
   * contendere due elementi alla cieca.
   */
  private async resolveCombineChoice(
    elements: readonly BaseElement[],
  ): Promise<Partial<Record<BaseElement, string>> | null> {
    const tip = this.playerTip();
    // Include l'eventuale carta nella punta della bacchetta (1.4.1) — conta come se fosse ancora in
    // mano, sia per rilevare l'ambiguità sia come candidata scelta bile dentro CombineDialogComponent.
    const hand = tip ? [...this.playerHand(), tip] : this.playerHand();
    const chosenAmbiguous = elements.filter((el) => combineNeedsChoice(hand, el));
    if (chosenAmbiguous.length === 0) return {};

    const forcedResiduo = elements.filter(
      (el) =>
        !chosenAmbiguous.includes(el) && !hand.some((c) => c.element === el && c.tier === 'base'),
    );
    const ambiguous = [...chosenAmbiguous, ...forcedResiduo];

    const ref = this.dialog.open<
      Partial<Record<BaseElement, string>> | undefined,
      CombineDialogData
    >(CombineDialogComponent, {
      data: { elements: ambiguous, hand },
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
    const result = await firstValueFrom(ref.closed);
    return result ?? null;
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

  /** Fase Raccolta (4.3), secondo passo — alternativa a keepCard: scarta entrambe le carte pescate e ottieni mana accumulato subito in mano, valido solo questo turno. */
  protected async keepMana(): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    await this.gameEngine.keepMana(this.gameId(), role);
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
    return [...player.hand, ...player.deck, ...player.discards].some(
      (card) => card.tier === 'freeze',
    );
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

  /** Regolamento 5: il Grimorio si può sfogliare "in qualsiasi momento" — passiamo comunque hand/canCreate così il bottone "Crea" (5.1) può auto-disabilitarsi quando non è la fase Azione del giocatore, senza dover riaprire la dialog per accorgersene. */
  protected openGrimoire(): void {
    const role = this.myRole();
    if (!role) return;

    const tip = this.playerTip();
    const hand = tip ? [...this.playerHand(), tip] : this.playerHand();

    this.dialog.open<void, GrimoireDialogData>(GrimoireDialogComponent, {
      data: { gameId: this.gameId(), role, hand, canCreate: this.canAdvancePhase() },
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

  /** Log eventi (danno/cura/scudo, veleno/congelamento risolti, incantesimi, combinazioni,
   * bacchetta...) — condiviso: la stessa lista (GameState.eventLog) letta da entrambi i client, la
   * dialog decide "tu"/nome dell'avversario confrontando GameLogEntry.role col proprio ruolo. */
  protected openGameLog(): void {
    const role = this.myRole();
    if (!role) return;

    this.dialog.open<void, GameLogDialogData>(GameLogDialogComponent, {
      data: {
        entries: this.state()?.eventLog ?? [],
        myRole: role,
        opponentName: this.opponentName(),
      },
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  /** Mazzo/scarti propri — sempre scoperti, 3 righe (Mazzo: Elementi, Mazzo: Incantesimi, Scarti). Stesso dialog sia dal click sul mazzo sia dagli scarti. */
  protected openOwnPileDialog(): void {
    const me = this.me();
    if (!me) return;
    this.openPileDialog({
      titleKey: 'pileDialog.ownTitle',
      deckCards: me.deck,
      discardCards: me.discards,
      deckRevealed: true,
    });
  }

  /** Mazzo/scarti dell'avversario — il mazzo si mostra coperto (CardComponent [revealed]="false"), gli scarti restano sempre pubblici. */
  protected openOpponentPileDialog(): void {
    const opponent = this.opponentState();
    if (!opponent) return;
    this.openPileDialog({
      titleKey: 'pileDialog.opponentTitle',
      titleParams: { name: this.opponentName() },
      deckCards: opponent.deck,
      discardCards: opponent.discards,
      deckRevealed: false,
    });
  }

  /** Scarti del mazzo comune — pila generica, una sola riga. Il mazzo comune coperto non è mai cliccabile: nascosto a entrambi i giocatori per definizione. */
  protected openCommonDiscardDialog(): void {
    const state = this.state();
    if (!state) return;
    this.openPileDialog({
      titleKey: 'pileDialog.commonDiscardTitle',
      discardCards: state.commonDiscards,
    });
  }

  /** Scarti del mazzo avanzato — pila generica, una sola riga. Stesso motivo di openCommonDiscardDialog per il mazzo avanzato coperto: mai cliccabile. */
  protected openAdvancedDiscardDialog(): void {
    const state = this.state();
    if (!state) return;
    this.openPileDialog({
      titleKey: 'pileDialog.advancedDiscardTitle',
      discardCards: state.advancedDiscards,
    });
  }

  private openPileDialog(data: PileDialogData): void {
    this.dialog.open<void, PileDialogData>(PileDialogComponent, {
      data,
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }
}
