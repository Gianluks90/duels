import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { Card } from '../../models/card.model';
import { computePlayerMana } from '../../models/player.model';
import { SPELL_CATALOG } from '../../data/spells';
import { TARGET_CARD_EFFECT_TYPES } from '../../models/spell.model';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface CastSpellDialogData {
  /** La carta incantesimo (tier 'spell') che si sta cercando di lanciare. */
  spellCard: Card;
  /** Il resto della mano, già filtrato dal chiamante (esclusi tier 'spell'/'freeze' — non pagabili, 3.1). Include l'eventuale carta nella punta della bacchetta (1.4.1), pagabile anche lei. */
  payableHand: Card[];
  /** Scarti del giocatore. Letti solo se la magia richiede una carta bersaglio (TARGET_CARD_EFFECT_TYPES, es. 'boost_card_mana'): il bersaglio si sceglie tra le proprie carte già scartate, non in mano (turn-engine.ts, castSpell/applyBoostCardMana). */
  discards: Card[];
}

export interface CastSpellDialogResult {
  paidCardIds: string[];
  /** Presente solo se la magia richiede una carta bersaglio — vedi CastSpellDialogData.hand. */
  targetCardId?: string;
}

/** Ritorna il pagamento (ed eventuale bersaglio) scelti (dialogRef.close(result)), o undefined se annullato — primo dialog nel codebase a restituire un risultato via .closed. */
@Component({
  selector: 'app-cast-spell-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconButtonComponent, TranslatePipe],
  templateUrl: './cast-spell-dialog.component.html',
  styleUrl: './cast-spell-dialog.component.scss',
})
export class CastSpellDialogComponent {
  private readonly dialogRef = inject<DialogRef<CastSpellDialogResult | undefined>>(DialogRef);
  private readonly data = inject<CastSpellDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly payableHand = this.data.payableHand;

  protected readonly spell = computed(
    () => SPELL_CATALOG.find((s) => s.id === this.data.spellCard.spellId) ?? null,
  );
  protected readonly spellName = computed(() => {
    const spell = this.spell();
    return spell ? this.i18n.t(`spells.${spell.id}.name`) : '';
  });

  /** true se uno degli effetti della magia richiede una carta bersaglio scelta dal giocatore (es. 'boost_card_mana') invece di un target cablato (avversario/sé stesso/casuale). */
  protected readonly needsTarget = computed(() => {
    const spell = this.spell();
    return !!spell && spell.effects.some((e) => TARGET_CARD_EFFECT_TYPES.includes(e.type));
  });

  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly targetCardId = signal<string | null>(null);

  /** Elementi reali (base/avanzato/potente) nei propri scarti — pool separato dalla mano, quindi mai in conflitto con le carte scelte come pagamento (turn-engine.ts, castSpell). Un Residuo/mana accumulato non finisce mai negli scarti (si consuma), quindi non compare mai qui. */
  protected readonly targetableCards = computed(() =>
    this.data.discards.filter(
      (c) => c.tier === 'base' || c.tier === 'advanced' || c.tier === 'superior',
    ),
  );

  protected readonly totalPaid = computed(() =>
    computePlayerMana(this.payableHand.filter((card) => this.selectedIds().has(card.id))),
  );
  protected readonly canConfirm = computed(() => {
    const spell = this.spell();
    if (!spell || this.totalPaid() < spell.manaCost) return false;
    if (!this.needsTarget() || this.targetableCards().length === 0) return true;
    return this.targetCardId() !== null;
  });

  protected toggle(cardId: string): void {
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  protected selectTarget(cardId: string): void {
    this.targetCardId.set(this.targetCardId() === cardId ? null : cardId);
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.dialogRef.close({
      paidCardIds: [...this.selectedIds()],
      targetCardId: this.targetCardId() ?? undefined,
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
