import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Nessun valore di ritorno: a differenza di JoinGameDialogComponent non c'è una navigazione da
 * fare dopo la chiusura — lo sblocco è già riflesso live in AuthService.profile (letto ovunque via
 * signal, es. la griglia dorsi in CollectionComponent), non serve che il chiamante reagisca. */
@Component({
  selector: 'app-redeem-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './redeem-dialog.component.html',
  styleUrl: './redeem-dialog.component.scss',
})
export class RedeemDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  protected readonly code = signal('');
  protected readonly redeeming = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly unlockedCardBackId = signal<string | null>(null);

  protected close(): void {
    this.dialogRef.close();
  }

  protected async redeem(): Promise<void> {
    if (this.redeeming() || !this.code().trim()) return;

    this.redeeming.set(true);
    this.error.set(null);
    try {
      const cardBackId = await this.auth.redeemCode(this.code());
      this.unlockedCardBackId.set(cardBackId);
    } catch (err) {
      this.error.set(this.errorMessage(err));
    } finally {
      this.redeeming.set(false);
    }
  }

  /** Stesso schema di JoinGameDialogComponent.errorMessage/FriendsDialogComponent: error code stabile
   * (AuthService.redeemCode) tradotto qui via il fallback "chiave non risolta = testo grezzo" di
   * TranslationService.t(). */
  private errorMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    const key = `redeem.errors.${code}`;
    const translated = this.i18n.t(key);
    return translated === key ? this.i18n.t('redeem.unknownError') : translated;
  }
}
