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
import { BackgroundService } from '../../services/background.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Select + anteprima + tasto Applica per lo sfondo dell'app. Presentazionale: la selezione locale
 * (selectedId) resta solo un'anteprima finché non si preme "Applica" (applied output) — il
 * chiamante (ProfileDialogComponent) decide come persisterla (AuthService.updateProfile), questo
 * componente non tocca il profilo direttamente.
 */
@Component({
  selector: 'app-background-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './background-picker.component.html',
  styleUrl: './background-picker.component.scss',
})
export class BackgroundPickerComponent {
  private readonly backgrounds = inject(BackgroundService);
  protected readonly i18n = inject(TranslationService);

  /** Id dello sfondo attualmente persistito sul profilo — la selezione locale si riallinea ogni
   * volta che cambia (es. dopo un salvataggio riuscito altrove, o al primo caricamento). */
  readonly current = input.required<string>();
  readonly applied = output<string>();

  protected readonly options = this.backgrounds.options;
  protected readonly selectedId = signal('');

  protected readonly selectedOption = computed(() =>
    this.options().find((o) => o.id === this.selectedId()),
  );
  protected readonly isDirty = computed(() => this.selectedId() !== this.current());

  constructor() {
    effect(() => this.selectedId.set(this.current()));
  }

  protected onSelectChange(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }

  protected optionLabelKey(id: string): string {
    return `profile.background.options.${id}`;
  }

  protected apply(): void {
    this.applied.emit(this.selectedId());
  }
}
