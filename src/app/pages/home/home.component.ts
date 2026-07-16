import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { TranslationService } from '../../services/translation.service';
import { BoardLayoutService } from '../../services/board-layout.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { RulebookDialogComponent } from '../../dialogs/rulebook/rulebook-dialog.component';
import { OptionsDialogComponent } from '../../dialogs/options/options-dialog.component';
import { GrimoireDialogComponent } from '../../dialogs/grimoire/grimoire-dialog.component';
import { ProfileDialogComponent } from '../../dialogs/profile/profile-dialog.component';
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
  imports: [
    ReactiveFormsModule,
    ActionMenuComponent,
    IconButtonComponent,
    CardComponent,
    TranslatePipe,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss', './home-compact.component.scss'],
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly boardLayout = inject(BoardLayoutService);
  protected readonly i18n = inject(TranslationService);

  protected readonly profile = this.auth.profile;
  protected readonly isDebugUser = this.auth.isDebugUser;

  protected readonly menuIcon = '/icons/menu_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
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
    { label: this.i18n.t('home.menu.profile'), action: () => this.openProfile() },
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
    items.push({ label: this.i18n.t('home.rulebook'), action: () => this.openRulebook() });
    items.push({ label: this.i18n.t('home.options'), action: () => this.openOptions() });
    return items;
  });

  protected readonly roomCode = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly joining = signal(false);
  protected readonly joinError = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly debugLoading = signal(false);

  protected readonly codeControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.minLength(6), Validators.maxLength(6)],
  });

  private waitingUnsub: (() => void) | null = null;

  ngOnInit(): void {
    this.codeControl.valueChanges.subscribe((v) => {
      this.codeControl.setValue(v.toUpperCase(), { emitEvent: false });
    });

    const sub = this.codeControl.valueChanges.subscribe(() => this.joinError.set(null));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
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

  protected async createGame(): Promise<void> {
    const profile = this.auth.profile();
    if (!profile) return;

    this.creating.set(true);
    try {
      const gameId = await this.game.createGame(profile);
      this.roomCode.set(gameId);
      this.startWaitingListener(gameId);
    } catch {
      this.creating.set(false);
    }
  }

  protected async cancelGame(): Promise<void> {
    const code = this.roomCode();
    if (!code) return;

    this.cancelling.set(true);
    this.stopWaitingListener();
    try {
      await this.game.cancelGame(code);
    } finally {
      this.roomCode.set(null);
      this.creating.set(false);
      this.cancelling.set(false);
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

  protected async joinGame(): Promise<void> {
    const profile = this.auth.profile();
    const code = this.codeControl.value.trim();
    if (!profile || code.length !== 6) return;

    this.joining.set(true);
    this.joinError.set(null);
    try {
      await this.game.joinGame(code, profile);
      this.router.navigate(['/setup', code]);
    } catch (err) {
      this.joinError.set(this.joinErrorMessage(err));
      this.joining.set(false);
    }
  }

  /** GameService throws stable error codes (not messages) — translated here, at the presentation layer. */
  private joinErrorMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    const key = `home.join.errors.${code}`;
    const translated = this.i18n.t(key);
    return translated === key ? this.i18n.t('home.join.unknownError') : translated;
  }

  protected async copyCode(): Promise<void> {
    const code = this.roomCode();
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
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
