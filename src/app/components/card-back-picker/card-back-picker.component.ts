import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
} from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CardBackService } from '../../services/card-back.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Griglia + tasto Applica per il dorso carte. Presentazionale: la selezione locale (selectedSkin)
 * resta solo un'anteprima finché non si preme "Applica" (applied output) — il chiamante
 * (ProfileDialogComponent) decide come persisterla (AuthService.updateProfile), questo componente
 * non tocca il profilo direttamente. Stesso schema di BackgroundPickerComponent.
 */
@Component({
  selector: 'app-card-back-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './card-back-picker.component.html',
  styleUrl: './card-back-picker.component.scss',
})
export class CardBackPickerComponent {
  private readonly auth = inject(AuthService);
  private readonly cardBackService = inject(CardBackService);

  /** Dorso attualmente persistito sul profilo — la selezione locale si riallinea ogni volta che
   * cambia (es. dopo un salvataggio riuscito altrove, o al primo caricamento). */
  readonly current = input.required<string>();
  readonly applied = output<string>();

  /** Unione tra i dorsi gratuiti (public/config/card-backs.json) e quelli sbloccati via "riscatta
   * codice" (profile.unlockedCardBacks) — un dorso non posseduto semplicemente non compare qui,
   * niente stato "locked" da mostrare. L'ownership vera è comunque imposta da firestore.rules
   * (cardBackValid), questo computed è solo cosa mostrare nel picker. */
  protected readonly ownedCardBacks = computed(() => [
    ...new Set([
      ...this.cardBackService.options(),
      ...(this.auth.profile()?.unlockedCardBacks ?? []),
    ]),
  ]);

  protected readonly selectedSkin = signal('');
  protected readonly isDirty = computed(() => this.selectedSkin() !== this.current());

  constructor() {
    effect(() => this.selectedSkin.set(this.current()));
  }

  protected select(skin: string): void {
    this.selectedSkin.set(skin);
  }

  protected apply(): void {
    this.applied.emit(this.selectedSkin());
  }
}
