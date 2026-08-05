import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { GameLogEntry } from '../../models/game-log.model';
import type { PlayerId } from '../../models/player.model';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { GameLogListComponent } from '../../components/game-log-list/game-log-list.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface GameLogDialogData {
  entries: readonly GameLogEntry[];
  /** Il proprio ruolo — decide "tu"/nome dell'avversario per ogni voce (GameLogEntry.role non porta
   * alcuna prospettiva, solo chi ha agito/subito: la stessa lista, letta da entrambi i client, produce
   * due frasi diverse a seconda di chi la guarda). */
  myRole: PlayerId;
  opponentName: string;
}

/**
 * Dialog "Eventi di gioco" — solo il guscio (header + chiudi), il rendering della lista vive in
 * GameLogListComponent (condiviso con la colonna "Eventi partita" a fine duello, v.
 * result.component.ts), non duplicato qui.
 */
@Component({
  selector: 'app-game-log-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe, GameLogListComponent],
  templateUrl: './game-log-dialog.component.html',
  styleUrl: './game-log-dialog.component.scss',
})
export class GameLogDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  protected readonly data = inject<GameLogDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  protected close(): void {
    this.dialogRef.close();
  }
}
