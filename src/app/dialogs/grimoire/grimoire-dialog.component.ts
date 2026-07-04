import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import type { Element } from '../../models/element.model';
import { elementIconPath } from '../../models/element.model';
import { CardComponent } from '../../components/card/card.component';
import type { Spell } from '../../models/spell.model';
import { SPELL_CATALOG } from '../../data/spells';

interface ElementFilter {
  element: Element;
  label: string;
}

@Component({
  selector: 'app-grimoire-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './grimoire-dialog.component.html',
  styleUrl: './grimoire-dialog.component.scss',
})
export class GrimoireDialogComponent {
  private readonly dialogRef = inject(DialogRef);

  protected readonly elementIconPath = elementIconPath;

  protected readonly elementFilters: ElementFilter[] = [
    { element: 'fire',     label: 'Fuoco' },
    { element: 'water',    label: 'Acqua' },
    { element: 'air',      label: 'Aria' },
    { element: 'earth',    label: 'Terra' },
    { element: 'thunder',  label: 'Tuono' },
    { element: 'ice',      label: 'Ghiaccio' },
    { element: 'poison',   label: 'Veleno' },
    { element: 'lava',     label: 'Lava' },
    { element: 'light',    label: 'Luce' },
    { element: 'dark',     label: 'Oscurità' },
    { element: 'residium', label: 'Residio' },
  ];

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

  protected effectLabel(effects: Spell['effects']): string {
    return effects
      .map(e => {
        switch (e.type) {
          case 'damage':
            return `Infligge ${e.amount ?? 1} danno all'avversario.`;
          case 'damage_ignore_shields':
            return `Infligge ${e.amount ?? 1} danno, ignora gli scudi.`;
          case 'damage_self':
            return `Infligge ${e.amount ?? 1} danno a sé stessi.`;
          case 'heal':
            return `Recupera ${e.amount ?? 1} punto ferita.`;
          case 'shield_add':
            return `Aggiunge ${e.amount ?? 1} scudo.`;
          case 'shield_remove_opponent':
            return `Rimuove ${e.amount ?? 1} scudo all'avversario.`;
          case 'poison_add':
            return `Applica ${e.amount ?? 1} veleno all'avversario.`;
          case 'ice_add':
            return `Applica ${e.amount ?? 1} ghiaccio all'avversario.`;
          case 'opponent_lose_mana':
            return `L'avversario perde ${e.amount ?? 1} mana.`;
          case 'opponent_discard_random':
            return `L'avversario scarta ${e.amount ?? 1} carta dalla mano.`;
          case 'reveal_opponent_hand':
            return "Rivela la mano dell'avversario.";
          case 'fonte_reset':
            return 'Resetta la Fonte Arcana.';
          default:
            return e.type;
        }
      })
      .join(' ');
  }

  protected range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
