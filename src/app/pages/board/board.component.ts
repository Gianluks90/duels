import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
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
import { AuthService } from '../../services/auth.service';
import { CardComponent } from '../../components/card/card.component';
import { DeckComponent } from '../../components/deck/deck.component';
import { PlayerHudComponent } from '../../components/player-hud/player-hud.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TooltipDirective } from '../../components/ui/tooltip/tooltip.directive';
import { GameSettingsDialogComponent } from '../../dialogs/game-settings/game-settings-dialog.component';
import { GrimoireDialogComponent } from '../../dialogs/grimoire/grimoire-dialog.component';
import { RulebookDialogComponent } from '../../dialogs/rulebook/rulebook-dialog.component';
import type { BaseElement, Element, AdvancedElement } from '../../models/element.model';
import { elementLabel, ADVANCED_RECIPES } from '../../models/element.model';
import type { Wand } from '../../models/wand.model';
import { ELEMENT_OPPOSITES } from '../../models/wand.model';
import type { TurnPhase } from '../../models/turn-phase.model';
import type { Health } from '../../models/player.model';

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

@Component({
  selector: 'app-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [CardComponent, DeckComponent, PlayerHudComponent, IconButtonComponent, TooltipDirective],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  protected readonly ELEMENT_OPPOSITES = ELEMENT_OPPOSITES;
  protected readonly elementLabel = elementLabel;

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

  // Mock game state — will be replaced by real GameState from Firestore
  // (shield mirrors the future PlayerTokens.shield, 0–3 — the player has one here to preview the bar's shield segment)
  protected readonly playerHealth   = signal<Health>({ max: 20, current: 14, shield: 2 });
  protected readonly opponentHealth = signal<Health>({ max: 20, current: 20, shield: 0 });
  protected readonly playerMana   = signal(3);
  protected readonly opponentMana = signal(2);
  protected readonly maxMana      = signal(6);
  protected readonly isPlayerTurn = signal(true);
  protected readonly turnPhase    = signal<TurnPhase>('azione');

  protected readonly opponentHandCount = signal(5);
  protected readonly fonteCards = signal<Element[]>(['thunder', 'ice', 'poison', 'thunder']);
  protected readonly playerHand = signal<Element[]>(['fire', 'air', 'water', 'earth', 'fire']);

  protected readonly residuoDeckCount   = signal(8);
  protected readonly commonDeckCount    = signal(20);
  protected readonly baseDeckCount      = signal(40);
  protected readonly baseDiscardCount   = signal(5);
  protected readonly baseDiscardTop     = signal<Element>('earth');
  protected readonly fonteDiscardCount  = signal(3);
  protected readonly fonteDiscardTop    = signal<Element>('poison');
  protected readonly playerDiscardCount   = signal(2);
  protected readonly playerDiscardTop     = signal<Element>('water');
  protected readonly playerDeckCount      = signal(12);
  protected readonly opponentDeckCount    = signal(10);
  protected readonly opponentDiscardCount = signal(1);
  protected readonly opponentDiscardTop   = signal<Element>('air');

  private readonly myRole = computed<'host' | 'guest' | null>(() => {
    const doc = this.gameDoc();
    const uid = this.auth.user()?.uid;
    if (!doc || !uid) return null;
    return doc.hostId === uid ? 'host' : 'guest';
  });

  protected readonly playerName = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return 'Tu';
    return this.myRole() === 'host' ? doc.hostName : (doc.guestName ?? 'Tu');
  });

  protected readonly opponentName = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return 'Avversario';
    return this.myRole() === 'host' ? (doc.guestName ?? 'Avversario') : doc.hostName;
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
  // TEMP mock — remove: shows the peek-card treatment on Asta without a live game.
  protected readonly playerBody   = computed(() => this.playerWand()?.bodySocket ?? 'fire');
  protected readonly playerHandle = computed(() => this.playerWand()?.handleSocket ?? null);

  protected readonly opponentTip    = computed(() => this.opponentWand()?.tipSlot ?? null);
  // TEMP mock — remove: shows the peek-card treatment on Asta without a live game.
  protected readonly opponentBody   = computed(() => this.opponentWand()?.bodySocket ?? 'fire');
  protected readonly opponentHandle = computed(() => this.opponentWand()?.handleSocket ?? null);

  protected readonly opponentHandRange = computed(() =>
    Array.from({ length: this.opponentHandCount() }, (_, i) => i)
  );

  constructor() {
    afterNextRender(() => {
      this.observeWidth(this.playerHandTrackRef(), this.playerHandTrackWidth);
      this.observeWidth(this.opponentHandTrackRef(), this.opponentHandTrackWidth);
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

  /** Recipe tooltip for an advanced card ("Fulmine: Fuoco + Aria") — null for elements with no 2-base recipe (base/superior/residium), so the directive stays silent. */
  protected recipeTooltip(el: Element): string | null {
    const recipe = ADVANCED_RECIPES[el as AdvancedElement];
    if (!recipe) return null;
    return `${elementLabel(el)}: ${elementLabel(recipe[0])} + ${elementLabel(recipe[1])}`;
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
