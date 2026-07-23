import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { AuthService } from '../../services/auth.service';
import { GameService, type GameDoc } from '../../services/game.service';
import { TranslationService } from '../../services/translation.service';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface JoinGameDialogData {
  gameDoc: GameDoc;
}

/** Chiude con `true` se il join è andato a buon fine (home.component.ts naviga a /setup/:id), `false`
 * se annullata o fallita — nessun controllo preventivo prima di aprirla: GameService.joinGame() è già
 * transazionale (vedi il commento lì), un doppio controllo qui sarebbe ridondante. */
@Component({
  selector: 'app-join-game-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './join-game-dialog.component.html',
  styleUrl: './join-game-dialog.component.scss',
})
export class JoinGameDialogComponent {
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly data = inject<JoinGameDialogData>(DIALOG_DATA);
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly gameDoc = this.data.gameDoc;

  protected readonly password = signal('');
  protected readonly joining = signal(false);
  protected readonly error = signal<string | null>(null);

  protected close(): void {
    this.dialogRef.close(false);
  }

  protected async join(): Promise<void> {
    const profile = this.auth.profile();
    if (!profile || this.joining()) return;

    this.joining.set(true);
    this.error.set(null);
    try {
      await this.game.joinGame(this.gameDoc.id, profile, this.password() || undefined);
      this.dialogRef.close(true);
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.joining.set(false);
    }
  }

  /** Stessi error code stabili di GameService, tradotti qui — stesso schema di
   * home.component.ts joinErrorMessage(). */
  private errorMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    const key = `joinGame.errors.${code}`;
    const translated = this.i18n.t(key);
    return translated === key ? this.i18n.t('joinGame.unknownError') : translated;
  }
}
