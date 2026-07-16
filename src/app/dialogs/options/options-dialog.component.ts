import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../services/auth.service';
import { AudioService } from '../../services/audio.service';
import { TranslationService } from '../../services/translation.service';
import { SUPPORTED_LANGUAGES, languageLabel, type LanguageCode } from '../../models/language.model';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-options-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './options-dialog.component.html',
  styleUrl: './options-dialog.component.scss',
})
export class OptionsDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly auth = inject(AuthService);
  private readonly audio = inject(AudioService);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly isDebugUser = this.auth.isDebugUser;

  protected readonly languages = SUPPORTED_LANGUAGES;
  protected readonly languageLabel = languageLabel;
  protected readonly musicEnabled = this.audio.musicEnabled;
  protected readonly fxEnabled = this.audio.fxEnabled;

  protected close(): void {
    this.dialogRef.close();
  }

  protected onLanguageChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as LanguageCode;
    void this.i18n.setLanguage(value);
  }

  protected toggleMusic(): void {
    this.audio.toggleMusic();
  }

  protected toggleFx(): void {
    this.audio.toggleFx();
  }
}
