import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-options-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './options-dialog.component.html',
  styleUrl: './options-dialog.component.scss',
})
export class OptionsDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isDebugUser = this.auth.isDebugUser;
  protected readonly confirmDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected close(): void {
    this.dialogRef.close();
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
      const msg = err instanceof Error ? err.message : 'Errore sconosciuto.';
      if (msg.includes('requires-recent-login')) {
        this.deleteError.set("Per sicurezza, esci e accedi nuovamente prima di eliminare l'account.");
      } else {
        this.deleteError.set(msg);
      }
      this.deleting.set(false);
    }
  }
}
