import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
 * leggibile: per un titolo non c'è nulla da "svelare" con la sorpresa, a differenza dell'arte). Il
 * titolo non partecipa MAI alla modalità personalizzazione sotto (resta un select in
 * ProfileDialogComponent, questione di identità più che di collezione) — `selectable`/`selected`
 * non hanno alcun effetto quando `shape() === 'title'`.
 *
 * Modalità personalizzazione (CollectionComponent.editMode, solo dorso/sfondo): un tile posseduto
 * diventa un radio button travestito da cerchio/cerchio-spunta dorato (`selectable` true, `selected`
 * = è la selezione pendente) — mai su un tile bloccato, non c'è nulla da equipaggiare lì. Il
 * raggruppamento "un solo selezionato per categoria" è responsabilità del chiamante
 * (CollectionComponent), non di questo componente: qui ci si limita a mostrare lo stato e a
 * emettere `select` al click/Invio/Spazio.
 *
 * FUORI dalla modalità personalizzazione, lo stesso `selected` (con `selectable` false) marca
 * invece l'elemento REALMENTE equipaggiato in questo momento — un piccolo badge statico, non
 * interattivo (icona sola, nessun tooltip proprio: due tooltip indipendenti su un'area così piccola,
 * quello del tile e quello del badge, comparirebbero entrambi passandoci sopra). La conferma testuale
 * (`activeLabel`, es. "Attivo") è invece una riga in più nel tooltip GIÀ esistente del tile, non un
 * secondo tooltip. */
@Component({
  selector: 'app-collection-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective],
  template: `
    @if (shape() === 'title') {
      <div
        class="collection-tile collection-tile--title"
        [class.collection-tile--locked]="!item().owned"
      >
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
        [class.collection-tile--selectable]="selectable()"
        tabindex="0"
        [attr.role]="selectable() ? 'radio' : null"
        [attr.aria-checked]="selectable() ? selected() : null"
        [attr.aria-label]="selectable() ? item().name : null"
        [appTooltip]="tooltipTpl"
        tooltipPosition="top"
        [tooltipWidth]="240"
        (click)="activate()"
        (keydown.enter)="activate()"
        (keydown.space)="activateOnSpace($event)"
      >
        @if (item().owned && item().imageUrl) {
          <img [src]="item().imageUrl" alt="" />
        } @else if (!item().owned) {
          <span
            class="collection-tile__lock"
            [style.mask-image]="lockIconUrl"
            [style.-webkit-mask-image]="lockIconUrl"
          ></span>
        } @else {
          <span class="collection-tile__owned-label">{{ item().name }}</span>
        }
        @if (selectable()) {
          <span
            class="collection-tile__radio"
            [class.collection-tile__radio--selected]="selected()"
            [style.mask-image]="radioIconUrl()"
            [style.-webkit-mask-image]="radioIconUrl()"
          ></span>
        } @else if (selected()) {
          <span
            class="collection-tile__radio collection-tile__radio--active"
            [style.mask-image]="activeIconUrl"
            [style.-webkit-mask-image]="activeIconUrl"
          ></span>
        }
      </div>

      <ng-template #tooltipTpl>
        <p class="collection-tile__tooltip-name">{{ item().name }}</p>
        <p class="collection-tile__tooltip-description">{{ item().description }}</p>
        <p class="collection-tile__tooltip-unlock">{{ item().unlockInfo }}</p>
        @if (!selectable() && selected()) {
          <p class="collection-tile__tooltip-active">{{ activeLabel() }}</p>
        }
      </ng-template>
    }
  `,
  styleUrl: './collection-tile.component.scss',
})
export class CollectionTileComponent {
  readonly item = input.required<CollectionItem>();
  readonly shape = input.required<CollectionTileShape>();
  /** true solo per un tile posseduto mentre CollectionComponent è in modalità personalizzazione —
   * mai su un tile bloccato, non c'è nulla da equipaggiare lì. Sempre false per shape 'title'. */
  readonly selectable = input(false);
  /** Con `selectable` true: è la selezione pendente per la sua categoria. Con `selectable` false:
   * è l'elemento REALMENTE equipaggiato in questo momento (mostra un badge statico "Attivo"). */
  readonly selected = input(false);
  /** Testo del tooltip sul badge statico "Attivo" (visibile solo quando `selected` è true e
   * `selectable` false) — risolto dal chiamante, questo componente non traduce nulla da solo. */
  readonly activeLabel = input('');
  readonly select = output<void>();

  protected readonly lockIconUrl = "url('/icons/lock_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg')";
  protected readonly activeIconUrl =
    "url('/icons/check_circle_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg')";
  protected readonly radioIconUrl = computed(() =>
    this.selected()
      ? this.activeIconUrl
      : "url('/icons/circle_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg')",
  );

  protected activate(): void {
    if (this.selectable()) this.select.emit();
  }

  /** Un `<div role="radio">` non attiva nulla nativamente su Invio/Spazio (a differenza di
   * bottoni/link) — vanno gestiti a mano. Spazio va anche impedito dal far scorrere la pagina
   * (comportamento di default del browser per la barra spaziatrice). */
  protected activateOnSpace(event: Event): void {
    if (!this.selectable()) return;
    event.preventDefault();
    this.select.emit();
  }
}
