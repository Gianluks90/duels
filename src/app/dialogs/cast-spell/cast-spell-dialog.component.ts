import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { Card } from '../../models/card.model';
import { ELEMENT_MANA } from '../../models/element.model';
import { computePlayerMana } from '../../models/player.model';
import { SPELL_CATALOG } from '../../data/spells';
import {
  TARGET_CARD_EFFECT_TYPES,
  MULTI_TARGET_CARD_EFFECT_TYPES,
  DEFAULT_CONSUMABLE_CARD_TIERS,
} from '../../models/spell.model';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface CastSpellDialogData {
  /** La carta incantesimo (tier 'spell') che si sta cercando di lanciare. */
  spellCard: Card;
  /** Il resto della mano, già filtrato dal chiamante (esclusi tier 'spell'/'freeze' — non pagabili, 3.1). Include l'eventuale carta nella punta della bacchetta (1.4.1), pagabile anche lei. */
  payableHand: Card[];
  /** Card.id della carta in payableHand che è in realtà trattenuta alla punta della bacchetta (1.4.1), non fisicamente in mano — null se la punta è vuota. Serve solo per mostrare il badge CardComponent.heldAtTip: senza, questa carta non si distinguerebbe in nessun modo dalle altre pagabili. */
  tipCardId: string | null;
  /** Scarti del giocatore. Letti solo se la magia richiede una carta bersaglio (TARGET_CARD_EFFECT_TYPES, es. 'boost_card_mana'): il bersaglio si sceglie tra le proprie carte già scartate, non in mano (turn-engine.ts, castSpell/applyBoostCardMana). */
  discards: Card[];
}

export interface CastSpellDialogResult {
  paidCardIds: string[];
  /** Presente solo se la magia richiede una carta bersaglio — vedi CastSpellDialogData.hand. */
  targetCardId?: string;
  /** Come targetCardId sopra, ma per le magie con bersagli in numero variabile (MULTI_TARGET_CARD_EFFECT_TYPES, es. 'consume_discards') — 0 a N carte, mai obbligatorio. */
  targetCardIds?: string[];
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
  protected readonly tipCardId = this.data.tipCardId;

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

  /** Come needsTarget sopra, ma per gli effetti con bersagli in numero VARIABILE (es. 'consume_discards', "Sciogliere") — a differenza di needsTarget la scelta non è mai obbligatoria (0 sempre valido), vedi canConfirm. */
  protected readonly needsMultiTarget = computed(() => {
    const spell = this.spell();
    return !!spell && spell.effects.some((e) => MULTI_TARGET_CARD_EFFECT_TYPES.includes(e.type));
  });

  /** L'effetto multi-target della magia (es. 'consume_discards'), se presente — fonte sia del tetto (multiTargetMax) sia del pool eleggibile (multiTargetableCards), che variano magia per magia (SpellEffect.consumableCardTiers, es. 'destroy' allarga a incantesimi/Congelamento rispetto a 'dissolve'). */
  protected readonly multiTargetEffect = computed(() => {
    const spell = this.spell();
    return spell?.effects.find((e) => MULTI_TARGET_CARD_EFFECT_TYPES.includes(e.type)) ?? null;
  });

  /** Tetto di carte selezionabili per l'effetto multi-target (effect.amount) — 0 se assente per qualche motivo, così toggleMultiTarget non selezionerebbe comunque nulla. */
  protected readonly multiTargetMax = computed(() => this.multiTargetEffect()?.amount ?? 0);

  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly targetCardId = signal<string | null>(null);
  protected readonly selectedTargetIds = signal<ReadonlySet<string>>(new Set());

  /** Elementi reali (base/avanzato/potente) nei propri scarti — pool separato dalla mano, quindi mai in conflitto con le carte scelte come pagamento (turn-engine.ts, castSpell). Un Residuo/mana accumulato non finisce mai negli scarti (si consuma), quindi non compare mai qui. */
  protected readonly targetableCards = computed(() =>
    this.data.discards.filter(
      (c) => c.tier === 'base' || c.tier === 'advanced' || c.tier === 'superior',
    ),
  );

  /** Pool eleggibile per la scelta a bersagli multipli — a differenza di targetableCards sopra (sempre solo elementi, per boost_card_mana) qui il tier ammesso dipende dalla magia: DEFAULT_CONSUMABLE_CARD_TIERS (solo elementi) se l'effetto non specifica altro, altrimenti SpellEffect.consumableCardTiers (es. 'destroy' include anche 'spell'/'freeze'). */
  protected readonly multiTargetableCards = computed(() => {
    const tiers = this.multiTargetEffect()?.consumableCardTiers ?? DEFAULT_CONSUMABLE_CARD_TIERS;
    return this.data.discards.filter((c) => tiers.includes(c.tier));
  });

  protected readonly totalPaid = computed(() =>
    computePlayerMana(this.payableHand.filter((card) => this.selectedIds().has(card.id))),
  );
  protected readonly canConfirm = computed(() => {
    const spell = this.spell();
    if (!spell || this.totalPaid() < spell.manaCost) return false;
    if (this.needsTarget() && this.targetableCards().length > 0 && this.targetCardId() === null) {
      return false;
    }
    // needsMultiTarget non compare qui: 0 carte selezionate è sempre una scelta valida (fino a 2, non
    // esattamente 2) — l'unico vincolo (il tetto) è già imposto da toggleMultiTarget, non da un guard qui.
    return true;
  });

  /** Valore in mana di una singola carta pagabile — stessa formula di computePlayerMana ma per una sola carta, serve per ordinare payableHand in autoSelect. */
  private cardManaValue(card: Card): number {
    const prismaticBonus = card.specialMana === 'prismatic' ? 1 : 0;
    return ELEMENT_MANA[card.element] + (card.manaBonus ?? 0) + prismaticBonus;
  }

  /** Seleziona in automatico le carte di pagamento necessarie a coprire il costo, riducendo i click ma senza lanciare l'incantesimo: prima il mana accumulato (tier 'mana', si perde comunque a fine turno se non speso), poi le carte di valore maggiore (il mana prismatico rientra già nel valore), infine le base da 1 — si ferma appena il totale copre il costo. */
  protected autoSelect(): void {
    const cost = this.spell()?.manaCost ?? 0;
    const sorted = [...this.payableHand].sort((a, b) => {
      const aAccumulated = a.element === 'mana' ? 1 : 0;
      const bAccumulated = b.element === 'mana' ? 1 : 0;
      if (aAccumulated !== bAccumulated) return bAccumulated - aAccumulated;
      return this.cardManaValue(b) - this.cardManaValue(a);
    });

    const selected = new Set<string>();
    let paid = 0;
    for (const card of sorted) {
      if (paid >= cost) break;
      selected.add(card.id);
      paid += this.cardManaValue(card);
    }
    this.selectedIds.set(selected);
  }

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

  protected toggleMultiTarget(cardId: string): void {
    this.selectedTargetIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < this.multiTargetMax()) {
        next.add(cardId);
      }
      return next;
    });
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.dialogRef.close({
      paidCardIds: [...this.selectedIds()],
      targetCardId: this.targetCardId() ?? undefined,
      targetCardIds: this.needsMultiTarget() ? [...this.selectedTargetIds()] : undefined,
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
