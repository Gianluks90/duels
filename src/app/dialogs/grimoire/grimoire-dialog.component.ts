import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import type { Element } from '../../models/element.model';
import { elementIconPath } from '../../models/element.model';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import type { Spell } from '../../models/spell.model';
import { SPELL_CATALOG } from '../../data/spells';

const FILTER_ELEMENTS: readonly Element[] = [
  'fire', 'water', 'air', 'earth',
  'thunder', 'ice', 'poison', 'lava',
  'light', 'dark', 'residium',
];

@Component({
  selector: 'app-grimoire-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconButtonComponent, TranslatePipe],
  templateUrl: './grimoire-dialog.component.html',
  styleUrl: './grimoire-dialog.component.scss',
})
export class GrimoireDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly elementIconPath = elementIconPath;
  protected readonly filterElements = FILTER_ELEMENTS;

  protected readonly activeFilters = signal<ReadonlySet<Element>>(new Set());
  protected readonly selectedSpellId = signal<string>(SPELL_CATALOG[0]?.id ?? '');

  protected readonly filteredSpells = computed<Spell[]>(() => {
    const active = this.activeFilters();
    if (active.size === 0) return SPELL_CATALOG;
    return SPELL_CATALOG.filter(s => s.formula.some(el => active.has(el)));
  });

  protected readonly selectedSpell = computed<Spell | null>(
    () => SPELL_CATALOG.find(s => s.id === this.selectedSpellId()) ?? null,
  );

  protected toggleFilter(element: Element): void {
    this.activeFilters.update(prev => {
      const next = new Set(prev);
      if (next.has(element)) next.delete(element);
      else next.add(element);
      return next;
    });
  }

  protected selectSpell(id: string): void {
    this.selectedSpellId.set(id);
  }

  protected spellName(spell: Spell): string {
    return this.i18n.t(`spells.${spell.id}.name`);
  }

  /** null when the dictionary has no flavorText entry for this spell (t() falls back to the raw key). */
  protected spellFlavorText(spell: Spell): string | null {
    const key = `spells.${spell.id}.flavorText`;
    const text = this.i18n.t(key);
    return text === key ? null : text;
  }

  protected effectLabel(effects: Spell['effects']): string {
    return effects
      .map(e => {
        const amount = e.amount ?? 1;
        switch (e.type) {
          case 'damage':
            return this.i18n.t('grimoire.effects.damage', { amount });
          case 'damage_ignore_shields':
            return this.i18n.t('grimoire.effects.damageIgnoreShields', { amount });
          case 'damage_self':
            return this.i18n.t('grimoire.effects.damageSelf', { amount });
          case 'heal':
            return this.i18n.t('grimoire.effects.heal', { amount });
          case 'shield_add':
            return this.i18n.t('grimoire.effects.shieldAdd', { amount });
          case 'shield_remove_opponent':
            return this.i18n.t('grimoire.effects.shieldRemoveOpponent', { amount });
          case 'poison_add':
            return this.i18n.t('grimoire.effects.poisonAdd', { amount });
          case 'ice_add':
            return this.i18n.t('grimoire.effects.iceAdd', { amount });
          case 'opponent_lose_mana':
            return this.i18n.t('grimoire.effects.opponentLoseMana', { amount });
          case 'opponent_discard_random':
            return this.i18n.t('grimoire.effects.opponentDiscardRandom', { amount });
          case 'reveal_opponent_hand':
            return this.i18n.t('grimoire.effects.revealOpponentHand');
          case 'fonte_reset':
            return this.i18n.t('grimoire.effects.fonteReset');
          default:
            return e.type;
        }
      })
      .join(' ');
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
