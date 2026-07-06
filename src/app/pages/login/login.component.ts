import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(TranslationService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async signIn(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.signInWithGoogle();
      await this.router.navigate(['/home']);
    } catch {
      this.error.set(this.i18n.t('login.error'));
      this.loading.set(false);
    }
  }
}
