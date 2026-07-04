import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { GameService } from '../../services/game.service';

export interface GameSettingsDialogData {
  gameId: string;
}

@Component({
  selector: 'app-game-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-settings-dialog.component.html',
  styleUrl: './game-settings-dialog.component.scss',
})
export class GameSettingsDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<GameSettingsDialogData>(DIALOG_DATA);
  private readonly game = inject(GameService);

  protected readonly confirmSurrender = signal(false);
  protected readonly surrendering = signal(false);

  protected close(): void {
    this.dialogRef.close();
  }

  protected requestConfirm(): void {
    this.confirmSurrender.set(true);
  }

  protected cancelConfirm(): void {
    this.confirmSurrender.set(false);
  }

  protected async surrender(): Promise<void> {
    this.surrendering.set(true);
    try {
      await this.game.surrender(this.data.gameId);
      this.dialogRef.close();
    } catch {
      this.surrendering.set(false);
    }
  }
}
