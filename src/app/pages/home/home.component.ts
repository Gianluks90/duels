import { Component, ChangeDetectionStrategy, inject, signal, DestroyRef, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { RulebookDialogComponent } from '../../dialogs/rulebook/rulebook-dialog.component';
import { OptionsDialogComponent } from '../../dialogs/options/options-dialog.component';
import { GrimoireDialogComponent } from '../../dialogs/grimoire/grimoire-dialog.component';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  protected readonly profile = this.auth.profile;
  protected readonly isDebugUser = this.auth.isDebugUser;

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
    this.codeControl.valueChanges.subscribe(v => {
      this.codeControl.setValue(v.toUpperCase(), { emitEvent: false });
    });

    const sub = this.codeControl.valueChanges.subscribe(() => this.joinError.set(null));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
    this.destroyRef.onDestroy(() => this.stopWaitingListener());

    const uid = this.auth.user()?.uid;
    if (uid) {
      this.game.findMyWaitingGame(uid).then(gameId => {
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

  protected async createGame(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    this.creating.set(true);
    try {
      const gameId = await this.game.createGame(user);
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
    this.waitingUnsub = this.game.listenToGame(gameId, gameDoc => {
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
    const user = this.auth.user();
    const code = this.codeControl.value.trim();
    if (!user || code.length !== 6) return;

    this.joining.set(true);
    this.joinError.set(null);
    try {
      await this.game.joinGame(code, user);
      this.router.navigate(['/setup', code]);
    } catch (err) {
      this.joinError.set(err instanceof Error ? err.message : 'Errore sconosciuto.');
      this.joining.set(false);
    }
  }

  protected async copyCode(): Promise<void> {
    const code = this.roomCode();
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  protected async startDebugGame(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    this.debugLoading.set(true);
    try {
      const gameId = await this.game.createDebugGame(user);
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
