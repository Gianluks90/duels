import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import type { CardBackSkin } from '../../models/player.model';

const CARD_BACKS: readonly CardBackSkin[] = ['dark', 'light'];

@Component({
  selector: 'app-profile-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconButtonComponent, TranslatePipe],
  templateUrl: './profile-dialog.component.html',
  styleUrl: './profile-dialog.component.scss',
})
export class ProfileDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly profile = this.auth.profile;
  protected readonly cardBacks = CARD_BACKS;

  protected readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(24)],
  });
  protected readonly photoUrlControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.pattern(/^https?:\/\/.+/)],
  });

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);

  protected readonly confirmDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    const p = this.profile();
    this.nameControl.setValue(p?.displayName ?? '');
    this.photoUrlControl.setValue(p?.photoURL ?? '');
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected async saveProfile(): Promise<void> {
    if (this.nameControl.invalid || this.photoUrlControl.invalid) return;

    this.saving.set(true);
    this.saved.set(false);
    try {
      await this.auth.updateProfile({
        displayName: this.nameControl.value.trim(),
        photoURL: this.photoUrlControl.value.trim() || null,
      });
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
    } finally {
      this.saving.set(false);
    }
  }

  protected async selectCardBack(skin: CardBackSkin): Promise<void> {
    if (this.profile()?.cardBack === skin) return;
    await this.auth.updateProfile({ cardBack: skin });
  }

  protected requestConfirm(): void {
    this.confirmDelete.set(true);
  }

  protected cancelConfirm(): void {
    this.confirmDelete.set(false);
    this.deleteError.set(null);
  }

  protected async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.auth.deleteAccount();
      this.dialogRef.close();
      await this.router.navigate(['/login']);
    } catch (err) {
      const msg = err instanceof Error ? err.message : this.i18n.t('profile.danger.unknownError');
      if (msg.includes('requires-recent-login')) {
        this.deleteError.set(this.i18n.t('profile.danger.reauthRequired'));
      } else {
        this.deleteError.set(msg);
      }
      this.deleting.set(false);
    }
  }
}
