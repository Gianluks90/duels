import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { Card, SpecialMana } from '../../models/card.model';
import { specialManaIconPath, REVEALED_ICON } from '../../models/card.model';
import { computePlayerMana } from '../../models/player.model';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TooltipDirective } from '../../components/ui/tooltip/tooltip.directive';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { SPELL_CATALOG } from '../../data/spells';

export interface PileDialogData {
  titleKey: string;
  titleParams?: Record<string, string | number>;
  /** Presente solo per le pile personali (mazzo+scarti di un giocatore) — se assente, la dialog mostra una sola riga (discardCards), senza sottotitolo. */
  deckCards?: readonly Card[];
  discardCards: readonly Card[];
  /** false per il mazzo dell'avversario: le carte di deckCards si mostrano coperte (CardComponent [revealed]="false") — l'array passato resta comunque quello vero, stesso principio già in uso per la mano dell'avversario (board.component.ts, opponentHand()): il client ha già il dato reale, si nasconde solo visivamente. Ignorato se deckCards è assente. */
  deckRevealed?: boolean;
}

interface PileRow {
  subtitleKey: string | null;
  cards: readonly Card[];
  revealed: boolean;
}

/** Fisse "righe visive" per lo sfoglio a ventaglio — spezza ogni riga logica in blocchi di questa dimensione, indipendentemente dalla larghezza reale (a differenza del ventaglio della mano in board.component.ts, questa dialog ha una larghezza fissa, non serve una misurazione dinamica). */
const CARDS_PER_VISUAL_ROW = 15;

@Component({
  selector: 'app-pile-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconButtonComponent, TooltipDirective, TranslatePipe, NgTemplateOutlet],
  templateUrl: './pile-dialog.component.html',
  styleUrl: './pile-dialog.component.scss',
})
export class PileDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<PileDialogData>(DIALOG_DATA);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly titleKey = this.data.titleKey;
  protected readonly titleParams = this.data.titleParams;
  protected readonly specialManaIconPath = specialManaIconPath;
  /** CSS mask-image richiede il valore completo `url(...)`, stessa ragione di CardComponent.revealedIconUrl. */
  protected readonly revealedIconUrl = `url(${REVEALED_ICON})`;

  /** 3 righe (Mazzo: Elementi, Mazzo: Incantesimi, Scarti) se deckCards è presente, altrimenti 1 sola riga (discardCards, senza sottotitolo). */
  protected readonly rows = computed<PileRow[]>(() => {
    const deck = this.data.deckCards;
    if (!deck) {
      return [{ subtitleKey: null, cards: this.sortCards(this.data.discardCards), revealed: true }];
    }

    const deckRevealed = this.data.deckRevealed ?? true;
    return [
      {
        subtitleKey: 'pileDialog.deckElements',
        cards: this.sortCards(deck.filter((c) => c.tier !== 'spell')),
        revealed: deckRevealed,
      },
      {
        subtitleKey: 'pileDialog.deckSpells',
        cards: this.sortCards(deck.filter((c) => c.tier === 'spell')),
        revealed: deckRevealed,
      },
      {
        subtitleKey: 'pileDialog.discard',
        cards: this.sortCards(this.data.discardCards),
        revealed: true,
      },
    ];
  });

  /** Spezza la riga in blocchi da CARDS_PER_VISUAL_ROW carte — ciascuno renderizzato come una propria riga di ventaglio (il margine negativo che crea la sovrapposizione riparte da zero a ogni blocco). */
  protected visualRows(row: PileRow): readonly Card[][] {
    const chunks: Card[][] = [];
    for (let i = 0; i < row.cards.length; i += CARDS_PER_VISUAL_ROW) {
      chunks.push(row.cards.slice(i, i + CARDS_PER_VISUAL_ROW));
    }
    return chunks;
  }

  /** Nome tradotto dell'elemento, o dell'incantesimo per una carta tier 'spell' — stesso lookup già usato in GrimoireDialogComponent/board.component.ts (spells.<id>.name). */
  private cardLabel(card: Card): string {
    if (card.tier === 'spell' && card.spellId) return this.i18n.t(`spells.${card.spellId}.name`);
    return this.i18n.elementLabel(card.element);
  }

  private cardManaValue(card: Card): number {
    if (card.tier === 'spell') {
      const spell = SPELL_CATALOG.find((s) => s.id === card.spellId);
      return spell?.manaCost ?? 0;
    }
    return computePlayerMana([card]);
  }

  /** Alfabetico per nome (elemento o incantesimo), poi mana crescente a parità di nome, con le carte a mana speciale spinte in fondo al proprio gruppo di nome. */
  private sortCards(cards: readonly Card[]): Card[] {
    return [...cards].sort((a, b) => {
      const nameCmp = this.cardLabel(a).localeCompare(this.cardLabel(b));
      if (nameCmp !== 0) return nameCmp;
      const specialCmp = (a.specialMana ? 1 : 0) - (b.specialMana ? 1 : 0);
      if (specialCmp !== 0) return specialCmp;
      return this.cardManaValue(a) - this.cardManaValue(b);
    });
  }

  /** Nome tradotto dell'incantesimo — stringa vuota se la carta non è (più) una carta incantesimo valida (stesso guard di board.component.ts, spellName). */
  protected spellName(card: Card): string {
    if (!card.spellId) return '';
    return this.i18n.t(`spells.${card.spellId}.name`);
  }

  /** null se il dizionario non ha una voce flavorText per questo incantesimo (t() ricade sulla chiave grezza) — stesso guard di GrimoireDialogComponent/board.component.ts. */
  protected spellFlavor(card: Card): string | null {
    if (!card.spellId) return null;
    const key = `spells.${card.spellId}.flavorText`;
    const text = this.i18n.t(key);
    return text === key ? null : text;
  }

  /** Stessa formattazione completa di GrimoireDialogComponent.effectLabel (non la versione ridotta damage/heal di board.component.ts, spellEffectSummary) — include il testo elemento-consapevole del danno (1.4.2) e tutti gli SpellEffectType già coperti dal Grimorio. */
  protected spellEffectLabel(card: Card): string {
    const spell = SPELL_CATALOG.find((s) => s.id === card.spellId);
    if (!spell) return '';
    return spell.effects
      .map((e) => {
        const amount = e.amount ?? 1;
        switch (e.type) {
          case 'damage':
            return spell.element
              ? this.i18n.t('grimoire.effects.damageElement', {
                  amount,
                  element: this.i18n.elementLabel(spell.element),
                })
              : this.i18n.t('grimoire.effects.damage', { amount });
          case 'damage_ignore_shields':
            return this.i18n.t('grimoire.effects.damageIgnoreShields', { amount });
          case 'damage_self':
            return this.i18n.t('grimoire.effects.damageSelf', { amount });
          case 'damage_halve_opponent':
            return this.i18n.t('grimoire.effects.damageHalveOpponent');
          case 'damage_from_fonte':
            return this.i18n.t('grimoire.effects.damageFromFonte');
          case 'heal':
            return this.i18n.t('grimoire.effects.heal', { amount });
          case 'shield_add':
            return this.i18n.t('grimoire.effects.shieldAdd', { amount });
          case 'shield_remove_opponent':
            return e.amount !== undefined
              ? this.i18n.t('grimoire.effects.shieldRemoveOpponent', { amount: e.amount })
              : this.i18n.t('grimoire.effects.shieldRemoveOpponentAll');
          case 'poison_add':
            return this.i18n.t('grimoire.effects.poisonAdd', { amount });
          case 'ice_add':
            return this.i18n.t('grimoire.effects.iceAdd', { amount });
          case 'poison_clear_self':
            return this.i18n.t('grimoire.effects.poisonClearSelf');
          case 'ice_clear_self':
            return this.i18n.t('grimoire.effects.iceClearSelf');
          case 'opponent_discard_random':
            return this.i18n.t('grimoire.effects.opponentDiscardRandom', { amount });
          case 'opponent_discard_hand':
            return this.i18n.t('grimoire.effects.opponentDiscardHand');
          case 'reveal_opponent_hand':
            if (e.cardTierFilter === 'spell') {
              return e.amount !== undefined
                ? this.i18n.t('grimoire.effects.revealOpponentHandRandomSpell', { amount: e.amount })
                : this.i18n.t('grimoire.effects.revealOpponentHandSpell');
            }
            return e.amount !== undefined
              ? this.i18n.t('grimoire.effects.revealOpponentHandRandom', { amount: e.amount })
              : this.i18n.t('grimoire.effects.revealOpponentHand');
          case 'fonte_reset':
            return this.i18n.t('grimoire.effects.fonteReset');
          case 'boost_card_mana':
            return this.i18n.t('grimoire.effects.boostCardMana', { amount });
          default:
            return e.type;
        }
      })
      .join(' ');
  }

  /** Spiegazione testuale dell'effetto del mana speciale (3.2) — stesso lookup di board.component.ts/CardComponent. */
  protected specialManaEffectText(type: SpecialMana): string {
    return this.i18n.t(`card.specialManaEffect.${type}`);
  }

  /** Quali dei tooltip ricchi si applicano a questa carta — stessa logica di board.component.ts (niente 'mana' qui: un token accumulato non finisce mai in mazzo/scarti, si consuma sempre). */
  protected cardTooltipFlags(card: Card): boolean[] {
    return [
      card.tier === 'spell',
      card.tier === 'freeze',
      !!card.specialMana,
      !!card.revealedToOpponent,
    ];
  }

  protected hasCardTooltip(card: Card): boolean {
    return this.cardTooltipFlags(card).some(Boolean);
  }

  protected isMultiCardTooltip(card: Card): boolean {
    return this.cardTooltipFlags(card).filter(Boolean).length > 1;
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
