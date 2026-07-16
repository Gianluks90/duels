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
import {
  ActionMenuComponent,
  type ActionMenuItem,
} from '../../components/ui/action-menu/action-menu.component';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [ReactiveFormsModule, ActionMenuComponent, IconButtonComponent, TranslatePipe],
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
