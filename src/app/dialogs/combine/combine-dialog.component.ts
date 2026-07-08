import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { BaseElement } from '../../models/element.model';
import type { Card } from '../../models/card.model';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface CombineDialogData {
  /** Solo gli elementi per cui esiste davvero una scelta da fare (più copie esatte con qualcosa da proteggere, o una base esatta e un Residuo entrambi disponibili) — vedi combineNeedsChoice in turn-engine.ts. Non sono necessariamente indipendenti: lo stesso Residuo Arcano può comparire come candidato in più di uno slot (nessuna ricetta richiede due volte lo stesso elemento base, ma il pool di Residuo è condiviso tra tutti), quindi selezionarlo per uno slot lo esclude dagli altri (isTaken). */
  elements: readonly BaseElement[];
  hand: readonly Card[];
}

/** Ritorna la mappa elemento→id scelto (dialogRef.close(map)), o undefined se annullato. */
@Component({
  selector: 'app-combine-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconButtonComponent, TranslatePipe],
  templateUrl: './combine-dialog.component.html',
  styleUrl: './combine-dialog.component.scss',
})
export class CombineDialogComponent {
  private readonly dialogRef = inject<DialogRef<Partial<Record<BaseElement, string>> | undefined>>(DialogRef);
  private readonly data = inject<CombineDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly elements = this.data.elements;

  protected readonly chosen = signal<Partial<Record<BaseElement, string>>>({});
  protected readonly canConfirm = computed(() => {
    const chosen = this.chosen();
    return this.elements.every(el => !!chosen[el]);
  });

  /** Le carte base esatte per questo elemento, più ogni Residuo Arcano in mano (jolly valido per qualunque elemento, 2.5) — la mano è un'istantanea presa all'apertura della dialog, non cambia durante la scelta. */
  protected candidatesFor(element: BaseElement): Card[] {
    const exact = this.data.hand.filter(card => card.element === element && card.tier === 'base');
    const residuo = this.data.hand.filter(card => card.tier === 'residium');
    return [...exact, ...residuo];
  }

  protected isSelected(element: BaseElement, cardId: string): boolean {
    return this.chosen()[element] === cardId;
  }

  /** true se questa carta è già stata scelta per un ALTRO slot — capita solo con un Residuo, unica carta che può comparire come candidata in più di uno slot (una stessa base esatta appartiene a un solo elemento). Evita di spendere la stessa copia due volte. */
  protected isTaken(element: BaseElement, cardId: string): boolean {
    const chosen = this.chosen();
    return this.elements.some(el => el !== element && chosen[el] === cardId);
  }

  protected select(element: BaseElement, cardId: string): void {
    if (this.isTaken(element, cardId)) return;
    this.chosen.update(prev => ({ ...prev, [element]: cardId }));
  }

  protected elementLabel(element: BaseElement): string {
    return this.i18n.elementLabel(element);
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.dialogRef.close(this.chosen());
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
