import { Component, ChangeDetectionStrategy, inject, input, output, signal, computed, effect } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { freeTitleVariantIdsFor } from '../../data/titles';

/**
 * Select + tasto Applica per il titolo del profilo — stesso schema selezione+Applica di
 * CardBackPickerComponent/BackgroundPickerComponent (select invece di pillole/griglia: con tutte
 * le varianti di genere possibili sarebbero troppe da mostrare affiancate). `ownedTitleIds` unisce
 * le variant-id
 * equipaggiabili senza riscatto per QUESTO utente (`freeTitleVariantIdsFor`, v. data/titles.ts —
 * titoli gratuiti per chiunque + titoli esclusivi il cui uid combacia col proprio, non serve
 * possederle esplicitamente in `unlockedTitles`, stesso schema di
 * CardBackPickerComponent.ownedCardBacks) con quelle effettivamente sbloccate via obiettivo — ogni
 * variante è un id a sé con il proprio testo tradotto (`collection.titleCatalog.<id>.name`, v.
 * TranslationService.titleLabel), scelta libera fra quelle possedute.
 */
@Component({
  selector: 'app-title-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './title-picker.component.html',
  styleUrl: './title-picker.component.scss',
})
export class TitlePickerComponent {
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(TranslationService);

  /** Titolo attualmente equipaggiato sul profilo — la selezione locale si riallinea ogni volta che
   * cambia (stesso pattern di CardBackPickerComponent.current). */
  readonly current = input.required<string>();
  readonly applied = output<string>();

  protected readonly ownedTitleIds = computed(() => [
    ...new Set([
      ...freeTitleVariantIdsFor(this.auth.user()?.uid),
      ...(this.auth.profile()?.unlockedTitles ?? []),
    ]),
  ]);

  protected readonly selectedId = signal('');
  protected readonly isDirty = computed(() => this.selectedId() !== this.current());

  constructor() {
    effect(() => this.selectedId.set(this.current()));
  }

  protected onSelectChange(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }

  protected apply(): void {
    this.applied.emit(this.selectedId());
  }
}
