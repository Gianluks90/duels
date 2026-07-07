import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { Card } from '../../models/card.model';
import { computePlayerMana } from '../../models/player.model';
import { SPELL_CATALOG } from '../../data/spells';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface CastSpellDialogData {
  /** La carta incantesimo (tier 'spell') che si sta cercando di lanciare. */
  spellCard: Card;
  /** Il resto della mano, già filtrato dal chiamante (esclusi tier 'spell'/'freeze' — non pagabili, 3.1). */
  payableHand: Card[];
}

/** Ritorna gli id delle carte scelte come pagamento (dialogRef.close(ids)), o undefined se annullato — primo dialog nel codebase a restituire un risultato via .closed. */
@Component({
  selector: 'app-cast-spell-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconButtonComponent, TranslatePipe],
  templateUrl: './cast-spell-dialog.component.html',
  styleUrl: './cast-spell-dialog.component.scss',
})
export class CastSpellDialogComponent {
  private readonly dialogRef = inject<DialogRef<string[] | undefined>>(DialogRef);
  private readonly data = inject<CastSpellDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly payableHand = this.data.payableHand;

  protected readonly spell = computed(() => SPELL_CATALOG.find(s => s.id === this.data.spellCard.spellId) ?? null);
  protected readonly spellName = computed(() => {
    const spell = this.spell();
    return spell ? this.i18n.t(`spells.${spell.id}.name`) : '';
  });

  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly totalPaid = computed(() =>
    computePlayerMana(this.payableHand.filter(card => this.selectedIds().has(card.id))),
  );
  protected readonly canConfirm = computed(() => {
    const spell = this.spell();
    return !!spell && this.totalPaid() >= spell.manaCost;
  });

  protected toggle(cardId: string): void {
    this.selectedIds.update(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.dialogRef.close([...this.selectedIds()]);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
