import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { BaseElement } from '../../models/element.model';
import { ELEMENT_OPPOSITES } from '../../models/wand.model';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type SocketTarget = 'body' | 'handle';

export interface SocketDialogData {
  /** Elemento della carta base che si sta per incastonare — usato come anteprima per lo slot ancora libero. */
  element: BaseElement;
  bodySocket: BaseElement | null;
  handleSocket: BaseElement | null;
}

interface SocketRow {
  target: SocketTarget;
  element: BaseElement;
  title: string;
  effect: string;
  locked: boolean;
}

/** Ritorna il target scelto (dialogRef.close('body' | 'handle')), o undefined se annullato. */
@Component({
  selector: 'app-socket-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconButtonComponent, TranslatePipe],
  templateUrl: './socket-dialog.component.html',
  styleUrl: './socket-dialog.component.scss',
})
export class SocketDialogComponent {
  private readonly dialogRef = inject<DialogRef<SocketTarget | undefined>>(DialogRef);
  private readonly data = inject<SocketDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  protected readonly selected = signal<SocketTarget | null>(null);
  protected readonly canConfirm = computed(() => this.selected() !== null);

  /**
   * Riga per l'asta (bodySocket) e riga per il manico (handleSocket) — mostrate sempre entrambe
   * (anche quella già bloccata, 1.4.2/1.4.3), con l'elemento della carta come anteprima per lo slot
   * ancora libero. Stessa formattazione dell'effetto già usata nel pannello bacchetta sempre visibile
   * (board.component.ts, bodyEffectText/handleEffectText) — qui applicata all'elemento in anteprima
   * invece che a quello attuale del giocatore.
   */
  protected readonly rows = computed<SocketRow[]>(() => {
    const preview = this.data.element;
    return [
      {
        target: 'body',
        element: this.data.bodySocket ?? preview,
        title: this.i18n.t('board.wand.body'),
        effect: this.bodyEffectText(this.data.bodySocket ?? preview),
        locked: this.data.bodySocket !== null,
      },
      {
        target: 'handle',
        element: this.data.handleSocket ?? preview,
        title: this.i18n.t('board.wand.handle'),
        effect: this.handleEffectText(this.data.handleSocket ?? preview),
        locked: this.data.handleSocket !== null,
      },
    ];
  });

  private bodyEffectText(el: BaseElement): string {
    return this.i18n.t('board.wand.bodyEffect', {
      element: this.i18n.elementLabel(el),
      opposite: this.i18n.elementLabel(ELEMENT_OPPOSITES[el]),
    });
  }

  private handleEffectText(el: BaseElement): string {
    return this.i18n.t('board.wand.handleEffect', { element: this.i18n.elementLabel(el) });
  }

  protected select(row: SocketRow): void {
    if (row.locked) return;
    this.selected.set(row.target);
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.dialogRef.close(this.selected()!);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
