import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CardBackService } from '../../services/card-back.service';
import { BackgroundService } from '../../services/background.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Collezione (Achievements): dorsi/sfondi/titoli posseduti dall'utente, in sola lettura — le
 * scelte vere e proprie (equip) restano nella dialog profilo (CardBackPickerComponent/
 * BackgroundPickerComponent), questa pagina è solo "cosa ho sbloccato finora".
 */
@Component({
  selector: 'app-collection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe],
  templateUrl: './collection.component.html',
  styleUrl: './collection.component.scss',
})
export class CollectionComponent {
  private readonly auth = inject(AuthService);
  private readonly cardBackService = inject(CardBackService);
  private readonly backgroundService = inject(BackgroundService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(TranslationService);

  protected readonly ownedCardBacks = computed(() => [
    ...new Set([
      ...this.cardBackService.options(),
      ...(this.auth.profile()?.unlockedCardBacks ?? []),
    ]),
  ]);

  protected readonly ownedBackgrounds = computed(() => {
    const unlocked = new Set(this.auth.profile()?.unlockedBackgrounds ?? []);
    return this.backgroundService.options().filter((o) => o.free || unlocked.has(o.id));
  });

  protected readonly unlockedTitles = computed(() => this.auth.profile()?.unlockedTitles ?? []);

  protected goHome(): void {
    this.router.navigate(['/home']);
  }
}
