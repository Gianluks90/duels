import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TooltipDirective } from '../ui/tooltip/tooltip.directive';

export type CollectionTileShape = 'card' | 'background' | 'title';

/** Una voce mostrabile in griglia nella pagina Collezione — dorso/sfondo/titolo, posseduto o
 * ancora da sbloccare. `imageUrl` è l'arte reale (assente per tutto ciò che non ne ha ancora una:
 * i reward degli obiettivi sono ancora placeholder 'TODO_...', v. data/objectives.ts). */
export interface CollectionItem {
  id: string;
  imageUrl: string | null;
  owned: boolean;
  name: string;
  description: string;
  /** Condizione di sblocco (se non posseduto) o come è stato sbloccato (se posseduto) — già
   * risolto in testo dal chiamante (CollectionComponent), non calcolato qui: questo componente non
   * conosce OBJECTIVE_CATALOG né UserStats, solo come mostrare una voce. */
  unlockInfo: string;
}

/**
 * Singola tile della griglia Collezione. Dorsi/sfondi (`shape() === 'card' | 'background'`):
 * stessa dimensione (aspect ratio) sia da sbloccare (lucchetto dorato centrato, arte nascosta) sia
 * da posseduta (arte reale), con tooltip al passaggio del mouse/focus per nome/descrizione/
 * condizione — necessario perché l'arte va coperta finché non sbloccata.
 * Titoli (`shape() === 'title'`): niente arte da nascondere, quindi niente tooltip — una card
 * rettangolare sottile con nome ed eventuale condizione di sblocco scritti direttamente, un
 * lucchetto piccolo solo come indicatore se non ancora sbloccato (il testo resta comunque
 * leggibile: per un titolo non c'è nulla da "svelare" con la sorpresa, a differenza dell'arte).
 */
@Component({
  selector: 'app-collection-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    @if (shape() === 'title') {
      <div class="collection-tile collection-tile--title" [class.collection-tile--locked]="!item().owned">
        @if (!item().owned) {
          <span
            class="collection-tile__title-lock"
            [style.mask-image]="lockIconUrl"
            [style.-webkit-mask-image]="lockIconUrl"
          ></span>
        }
        <div class="collection-tile__title-text">
          <p class="collection-tile__title-name">{{ item().name }}</p>
          <p class="collection-tile__title-unlock">{{ item().unlockInfo }}</p>
        </div>
      </div>
    } @else {
      <div
        class="collection-tile"
        [class.collection-tile--card]="shape() === 'card'"
        [class.collection-tile--background]="shape() === 'background'"
        [class.collection-tile--locked]="!item().owned"
        tabindex="0"
        [appTooltip]="tooltipTpl"
        tooltipPosition="top"
        [tooltipWidth]="240"
      >
        @if (item().owned && item().imageUrl) {
          <img [src]="item().imageUrl" alt="" />
        } @else if (!item().owned) {
          <span class="collection-tile__lock" [style.mask-image]="lockIconUrl" [style.-webkit-mask-image]="lockIconUrl"></span>
        } @else {
          <span class="collection-tile__owned-label">{{ item().name }}</span>
        }
      </div>

      <ng-template #tooltipTpl>
        <p class="collection-tile__tooltip-name">{{ item().name }}</p>
        <p class="collection-tile__tooltip-description">{{ item().description }}</p>
        <p class="collection-tile__tooltip-unlock">{{ item().unlockInfo }}</p>
      </ng-template>
    }
  `,
  styleUrl: './collection-tile.component.scss',
})
export class CollectionTileComponent {
  readonly item = input.required<CollectionItem>();
  readonly shape = input.required<CollectionTileShape>();

  protected readonly lockIconUrl = "url('/icons/lock_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg')";
}
