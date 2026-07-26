import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { GameEngineService } from '../../services/game-engine.service';
import { AudioService } from '../../services/audio.service';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import type { PlayerId } from '../../models/player.model';

export interface GameSettingsDialogData {
  gameId: string;
  role: PlayerId;
}

@Component({
  selector: 'app-game-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './game-settings-dialog.component.html',
  styleUrl: './game-settings-dialog.component.scss',
})
export class GameSettingsDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<GameSettingsDialogData>(DIALOG_DATA);
  private readonly gameEngine = inject(GameEngineService);
  private readonly audio = inject(AudioService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly confirmSurrender = signal(false);
  protected readonly surrendering = signal(false);
  protected readonly musicEnabled = this.audio.musicEnabled;
  protected readonly fxEnabled = this.audio.fxEnabled;

  protected close(): void {
    this.dialogRef.close();
  }

  protected toggleMusic(): void {
    this.audio.toggleMusic();
  }

  protected toggleFx(): void {
    this.audio.toggleFx();
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
      await this.gameEngine.surrender(this.data.gameId, this.data.role);
      this.dialogRef.close();
    } catch {
      this.surrendering.set(false);
    }
  }
}
