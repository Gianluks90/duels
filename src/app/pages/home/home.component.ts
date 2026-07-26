import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { AuthService } from '../../services/auth.service';
import { GameService, type GameDoc } from '../../services/game.service';
import { FriendsService } from '../../services/friends.service';
import { TranslationService } from '../../services/translation.service';
import { BoardLayoutService } from '../../services/board-layout.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { RulebookDialogComponent } from '../../dialogs/rulebook/rulebook-dialog.component';
import { OptionsDialogComponent } from '../../dialogs/options/options-dialog.component';
import { GrimoireDialogComponent } from '../../dialogs/grimoire/grimoire-dialog.component';
import { ProfileDialogComponent } from '../../dialogs/profile/profile-dialog.component';
import { RedeemDialogComponent } from '../../dialogs/redeem/redeem-dialog.component';
import { FriendsDialogComponent } from '../../dialogs/friends/friends-dialog.component';
import { CreateGameDialogComponent } from '../../dialogs/create-game/create-game-dialog.component';
import {
  JoinGameDialogComponent,
  type JoinGameDialogData,
} from '../../dialogs/join-game/join-game-dialog.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { CardComponent } from '../../components/card/card.component';
import type { Element } from '../../models/element.model';
import {
  ActionMenuComponent,
  type ActionMenuItem,
} from '../../components/ui/action-menu/action-menu.component';

/** I 10 elementi "carta" del mazzo — Residuo Arcano e magie escluse di proposito (regolamento 2.1: non sono elementi veri, non hanno senso come decorazione "elemento" sullo sfondo). */
const BACKGROUND_ELEMENTS: readonly Element[] = [
  'fire',
  'water',
  'air',
  'earth',
  'thunder',
  'poison',
  'ice',
  'lava',
  'light',
  'dark',
];

interface BackgroundCard {
  element: Element;
  top: number;
  left: number;
  rotation: number;
  /** Ritardo prima del fade-in (ms), indipendente e casuale per ogni carta — non un ordine
   * sequenziale a indice: dà un effetto "materializzazione" organica invece che meccanico. */
  delay: number;
}

interface BackgroundPoint {
  top: number;
  left: number;
}

/** In punti percentuali (top/left condividono la stessa scala 0-100): sotto questa distanza le due
 * copie dello stesso elemento si leggono come "vicine" a colpo d'occhio invece che sparse. */
const MIN_SAME_ELEMENT_DISTANCE = 30;
/** Tentativi prima di arrendersi e accettare comunque il punto — pura decorazione, non serve una
 * garanzia matematica: con un solo vincolo (dalla prima copia) 30 tentativi bastano quasi sempre. */
const MAX_PLACEMENT_ATTEMPTS = 30;

function randomPoint(): BackgroundPoint {
  return { top: Math.random() * 100, left: Math.random() * 100 };
}

function distance(a: BackgroundPoint, b: BackgroundPoint): number {
  return Math.hypot(a.top - b.top, a.left - b.left);
}

/** Ripesca finché non è abbastanza lontano da `other` (la prima copia dello stesso elemento) — solo
 * questo vincolo, nessuno tra elementi diversi: evita le coppie identiche affiancate mantenendo
 * intatta la sensazione di casualità nel resto dello sfondo. */
function randomPointAwayFrom(other: BackgroundPoint): BackgroundPoint {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const point = randomPoint();
    if (distance(point, other) >= MIN_SAME_ELEMENT_DISTANCE) return point;
  }
  return randomPoint();
}

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [ActionMenuComponent, IconButtonComponent, CardComponent, TranslatePipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss', './home-compact.component.scss'],
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly friendsService = inject(FriendsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly boardLayout = inject(BoardLayoutService);
  protected readonly i18n = inject(TranslationService);

  protected readonly profile = this.auth.profile;
  protected readonly isDebugUser = this.auth.isDebugUser;

  protected readonly menuIcon = '/icons/menu_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly cancelIcon = '/icons/delete_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg';
  /** 2 carte per ciascuno dei 10 elementi (20 totali) — con solo 10 restavano troppi vuoti visibili
   * sullo sfondo. La seconda copia di ogni elemento ripesca la posizione finché non è a
   * MIN_SAME_ELEMENT_DISTANCE dalla prima (randomPointAwayFrom) — solo questo vincolo, nessuno tra
   * elementi diversi: evita le due copie identiche affiancate senza irrigidire il resto dello
   * sparpagliamento. Rotazione/delay restano indipendenti e casuali per ogni carta, coppie incluse.
   * Generate una sola volta qui (field initializer, gira nel costruttore) e mai più ricalcolate: un
   * nuovo layout a ogni caricamento della pagina, ma stabile per tutta la sessione della Home
   * (niente "salti" a ogni change detection). Puramente decorative (home.component.html,
   * aria-hidden sul contenitore) — nessuna interazione, nessun tooltip. */
  protected readonly backgroundCards: readonly BackgroundCard[] = BACKGROUND_ELEMENTS.flatMap(
    (element) => {
      const first = randomPoint();
      const second = randomPointAwayFrom(first);
      return [first, second].map((point) => ({
        element,
        top: point.top,
        left: point.left,
        rotation: Math.random() * 50 - 25,
        delay: Math.random() * 1000,
      }));
    },
  );
  /** Riusa BoardLayoutService (nome storico, ma generico — nessuna logica specifica della board al suo interno) invece di ricreare un secondo BreakpointObserver con soglie proprie: stessa fascia mobile/tablet/desktop in tutta l'app. */
  protected readonly layoutTier = this.boardLayout.tier;
  /** Home non ha bisogno di distinguere mobile da tablet come la board (nessun layout a due colonne intermedio qui) — un solo interruttore "sotto i 1024px" basta per collassare header e pannelli. */
  protected readonly isCompact = computed(() => this.layoutTier() !== 'desktop');

  protected readonly avatarMenuItems = computed<ActionMenuItem[]>(() => [
    { label: this.i18n.t('home.menu.myProfile'), action: () => this.openMyProfile() },
    { label: this.i18n.t('home.menu.profile'), action: () => this.openProfile() },
    { label: this.i18n.t('home.menu.redeemCode'), action: () => this.openRedeemDialog() },
    { label: this.i18n.t('home.menu.signOut'), action: () => this.signOut() },
  ]);

  /** Stesse azioni dei bottoni dell'header in versione desktop, raccolte in un unico menu a comparsa quando isCompact() — vedi home.component.html. */
  protected readonly headerMenuItems = computed<ActionMenuItem[]>(() => {
    const items: ActionMenuItem[] = [];
    if (this.isDebugUser()) {
      items.push({
        label: this.debugLoading() ? '…' : this.i18n.t('home.debug'),
        action: () => void this.startDebugGame(),
        disabled: this.debugLoading(),
      });
    }
    items.push({ label: this.i18n.t('home.grimoire'), action: () => this.openGrimoire() });
    items.push({ label: this.i18n.t('home.collection'), action: () => this.openCollection() });
    items.push({ label: this.i18n.t('home.objectives'), action: () => this.openObjectives() });
    items.push({ label: this.i18n.t('home.rulebook'), action: () => this.openRulebook() });
    items.push({ label: this.i18n.t('home.friends'), action: () => this.openFriends() });
    items.push({ label: this.i18n.t('home.options'), action: () => this.openOptions() });
    return items;
  });

  /** Id della MIA partita in attesa, se ne ho una — determina se il box mostra la riga "la tua
   * partita" + Annulla, oppure il bottone "Crea partita" (home.component.html). */
  protected readonly roomCode = signal<string | null>(null);
  protected readonly cancelling = signal(false);
  protected readonly debugLoading = signal(false);

  // ── Duelli in attesa di sfidante (Qualità della vita) ──────────────────────────
  /** Nessun onSnapshot: solo un fetch on-demand (al caricamento + bottone refresh manuale), coerente
   * con la scelta di non avere stato "online" nell'app. */
  protected readonly publicGames = signal<readonly GameDoc[]>([]);
  protected readonly publicGamesLoading = signal(false);
  /** uid degli amici (accettati) — per segnalare/separare le partite in cima alla lista, caricato una
   * volta insieme all'elenco partite. */
  protected readonly friendUids = signal<ReadonlySet<string>>(new Set());
  /** Esito dell'invio automatico della richiesta di amicizia via link (?friend=, vedi
   * handleFriendLink) — null finché non c'è nulla da segnalare. */
  protected readonly friendLinkResult = signal<'sent' | 'error' | null>(null);

  /** Sezione "Amici" — vuota il più delle volte, quindi la UI mostra le due sezioni con sottotitolo +
   * riga divisoria solo quando c'è almeno una partita qui, altrimenti resta una lista piatta unica
   * (solo otherGames). */
  protected readonly friendGames = computed(() =>
    this.publicGames().filter((g) => this.friendUids().has(g.hostId)),
  );
  protected readonly otherGames = computed(() =>
    this.publicGames().filter((g) => !this.friendUids().has(g.hostId)),
  );

  private waitingUnsub: (() => void) | null = null;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopWaitingListener());

    const uid = this.auth.user()?.uid;
    if (uid) {
      this.game.findMyWaitingGame(uid).then((gameId) => {
        if (gameId) {
          this.roomCode.set(gameId);
          this.startWaitingListener(gameId);
        }
      });
    }

    void this.loadPublicGames();
    void this.handleFriendLink();
  }

  /** Link amico (?friend=<uid>, vedi FriendsDialogComponent.myLink) — se presente, invia subito la
   * richiesta e ripulisce l'URL, così un refresh della pagina non la rimanda una seconda volta. */
  private async handleFriendLink(): Promise<void> {
    const targetUid = this.route.snapshot.queryParamMap.get('friend');
    const profile = this.auth.profile();
    if (!targetUid || !profile || targetUid === profile.uid) return;

    await this.router.navigate([], { queryParams: {}, replaceUrl: true });
    try {
      await this.friendsService.sendRequest(profile, targetUid);
      this.friendLinkResult.set('sent');
    } catch {
      this.friendLinkResult.set('error');
    }
    setTimeout(() => this.friendLinkResult.set(null), 4000);
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

  protected openOptions(): void {
    this.dialog.open(OptionsDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openProfile(): void {
    this.dialog.open(ProfileDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openCollection(): void {
    this.router.navigate(['/collection']);
  }

  protected openObjectives(): void {
    this.router.navigate(['/objectives']);
  }

  /** Il proprio profilo pubblico (Achievements) — distinto da openProfile() sopra, che apre invece
   * la dialog di MODIFICA (nome/foto/dorso/...). Questa è la stessa pagina che vedrebbe un amico. */
  protected openMyProfile(): void {
    const uid = this.auth.user()?.uid;
    if (uid) this.router.navigate(['/profile', uid]);
  }

  protected openRedeemDialog(): void {
    this.dialog.open(RedeemDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openFriends(): void {
    const ref = this.dialog.open(FriendsDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
    // La lista amici appena chiusa la dialog potrebbe essere cambiata (nuove accettazioni) — riflette
    // subito l'ordinamento "amici in cima" nella lobby pubblica senza dover ricaricare la pagina.
    ref.closed.subscribe(() => void this.loadPublicGames());
  }

  /** Duelli in attesa di sfidante (Qualità della vita): elenco partite 'waiting' + set di amici.
   * Rispetta subito `visibility` qui (non solo per l'ordinamento): una partita 'friends' di cui non
   * sono amico viene tolta dall'elenco stesso, così friendGames/otherGames non devono più saperlo —
   * stesso compromesso di password (vedi GameDoc.visibility), rispettato lato client. Nessun
   * listener — solo un fetch on-demand (al caricamento + refresh manuale). */
  protected async loadPublicGames(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;

    this.publicGamesLoading.set(true);
    try {
      const [games, friends] = await Promise.all([
        this.game.listOpenGames(),
        this.friendsService.listFriends(uid),
      ]);
      const friendSet = new Set(friends.map((r) => this.friendsService.otherUid(r, uid)));
      this.publicGames.set(
        games.filter(
          (g) => g.hostId !== uid && (g.visibility !== 'friends' || friendSet.has(g.hostId)),
        ),
      );
      this.friendUids.set(friendSet);
    } finally {
      this.publicGamesLoading.set(false);
    }
  }

  protected openCreateGameDialog(): void {
    const ref = this.dialog.open<string | null>(CreateGameDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
    ref.closed.subscribe((gameId) => {
      if (!gameId) return;
      this.roomCode.set(gameId);
      this.startWaitingListener(gameId);
      void this.loadPublicGames();
    });
  }

  protected openJoinGameDialog(gameDoc: GameDoc): void {
    const ref = this.dialog.open<boolean>(JoinGameDialogComponent, {
      data: { gameDoc } satisfies JoinGameDialogData,
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
    ref.closed.subscribe((joined) => {
      if (joined) this.router.navigate(['/setup', gameDoc.id]);
    });
  }

  protected async cancelGame(): Promise<void> {
    const code = this.roomCode();
    // app-icon-button non ha uno stato disabled proprio (icon-button.component.ts) — questo guard
    // sostituisce il [disabled]="cancelling()" che avevamo col vecchio bottone testuale, evitando un
    // doppio cancelGame() se si clicca due volte mentre la prima chiamata è ancora in corso.
    if (!code || this.cancelling()) return;

    this.cancelling.set(true);
    this.stopWaitingListener();
    try {
      await this.game.cancelGame(code);
    } finally {
      this.roomCode.set(null);
      this.cancelling.set(false);
      void this.loadPublicGames();
    }
  }

  private startWaitingListener(gameId: string): void {
    this.waitingUnsub = this.game.listenToGame(gameId, (gameDoc) => {
      if (gameDoc?.status === 'setup') {
        this.stopWaitingListener();
        this.router.navigate(['/setup', gameId]);
      }
    });
  }

  private stopWaitingListener(): void {
    this.waitingUnsub?.();
    this.waitingUnsub = null;
  }

  protected async startDebugGame(): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) return;
    this.debugLoading.set(true);
    try {
      const gameId = await this.game.createDebugGame(profile);
      await this.router.navigate(['/game', gameId]);
    } finally {
      this.debugLoading.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
