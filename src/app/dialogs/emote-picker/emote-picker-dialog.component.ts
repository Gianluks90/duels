import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';

export interface EmotePickerOption {
  emoteId: string;
  category: string;
  text: string;
}

export interface EmotePickerDialogData {
  options: readonly EmotePickerOption[];
}

/**
 * Elenco delle 6 emote equipaggiate (una per categoria, v. UserProfile.equippedEmotes) — click su
 * una riga chiude subito la dialog con l'emoteId scelto (`DialogRef.close`), niente conferma
 * separata: lanciare un'emote è un gesto a basso rischio, non ha bisogno di un secondo passaggio
 * come "Applica" in CollectionComponent. board.component.ts (openEmotePicker) risolve `options` da
 * EMOTE_CATALOG/equippedEmotes prima di aprire, così questa dialog resta presentazionale, nessuna
 * dipendenza da AuthService/EMOTE_CATALOG qui dentro.
 */
@Component({
  selector: 'app-emote-picker-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './emote-picker-dialog.component.html',
  styleUrl: './emote-picker-dialog.component.scss',
})
export class EmotePickerDialogComponent {
  private readonly dialogRef = inject(DialogRef<string | undefined>);
  private readonly data = inject<EmotePickerDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly options = this.data.options;

  protected pick(emoteId: string): void {
    this.dialogRef.close(emoteId);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
