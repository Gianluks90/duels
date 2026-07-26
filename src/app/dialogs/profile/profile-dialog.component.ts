import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { BackgroundPickerComponent } from '../../components/background-picker/background-picker.component';
import { CardBackPickerComponent } from '../../components/card-back-picker/card-back-picker.component';
import { TitlePickerComponent } from '../../components/title-picker/title-picker.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DEFAULT_BACKGROUND_ID } from '../../models/user.model';
import { freeTitleVariantIdsFor } from '../../data/titles';

@Component({
  selector: 'app-profile-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IconButtonComponent,
    BackgroundPickerComponent,
    CardBackPickerComponent,
    TitlePickerComponent,
    TranslatePipe,
  ],
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
  protected readonly currentBackground = computed(
    () => this.profile()?.background ?? DEFAULT_BACKGROUND_ID,
  );
  /** Sezione titolo nascosta solo se non esiste NESSUN titolo disponibile per QUESTO utente (né
   * gratuito/esclusivo né sbloccato) — con almeno un titolo gratuito in TITLE_CATALOG (v.
   * data/titles.ts) è ormai sempre vero, ma resta un guard corretto se in futuro non ce ne fosse
   * più nessuno. */
  protected readonly hasTitles = computed(
    () =>
      freeTitleVariantIdsFor(this.auth.user()?.uid).length > 0 ||
      (this.profile()?.unlockedTitles ?? []).length > 0,
  );

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

  protected async applyCardBack(skin: string): Promise<void> {
    if (this.profile()?.cardBack === skin) return;
    await this.auth.updateProfile({ cardBack: skin });
  }

  protected async applyBackground(id: string): Promise<void> {
    if (this.currentBackground() === id) return;
    await this.auth.updateProfile({ background: id });
  }

  protected async applyTitle(id: string): Promise<void> {
    if (this.profile()?.title === id) return;
    await this.auth.updateProfile({ title: id });
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
