import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { TranslationService } from '../../services/translation.service';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Chiude con l'id della partita appena creata, o null se annullata — home.component.ts lo usa per
 * avviare startWaitingListener() esattamente come faceva prima con createGame() inline. */
@Component({
  selector: 'app-create-game-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './create-game-dialog.component.html',
  styleUrl: './create-game-dialog.component.scss',
})
export class CreateGameDialogComponent {
  private readonly dialogRef = inject(DialogRef<string | null>);
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  protected readonly password = signal('');
  protected readonly friendsOnly = signal(false);
  protected readonly creating = signal(false);

  protected close(): void {
    this.dialogRef.close(null);
  }

  protected async create(): Promise<void> {
    const profile = this.auth.profile();
    if (!profile || this.creating()) return;

    this.creating.set(true);
    try {
      const gameId = await this.game.createGame(profile, {
        password: this.password() || undefined,
        friendsOnly: this.friendsOnly(),
      });
      this.dialogRef.close(gameId);
    } finally {
      this.creating.set(false);
    }
  }
}
