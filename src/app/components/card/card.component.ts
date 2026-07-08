import { Component, ChangeDetectionStrategy, input, computed, inject, signal, effect } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { Element } from '../../models/element.model';
import { elementImagePath, elementIconPath, ELEMENT_MANA } from '../../models/element.model';
import type { SpecialMana } from '../../models/card.model';
import { specialManaIconPath } from '../../models/card.model';
import { SPELL_CATALOG } from '../../data/spells';
import { TranslationService } from '../../services/translation.service';

/** Metà della durata di @keyframes card-flip (card.component.scss) — il volto mostrato si scambia esattamente qui, nell'istante invisibile a larghezza zero. */
const CARD_FLIP_HALF_MS = 150;

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  template: `
    @if (displayedRevealed()) {
      @if (spell(); as s) {
        <!-- Placeholder temporaneo (regolamento 5): nessuna arte propria per gli incantesimi ancora, sfondo pergamena + gettone con l'icona bacchetta-stelle. -->
        <div class="card__spell-bg" aria-hidden="true"></div>
        <div class="card__spell-token" aria-hidden="true">
          <img class="card__spell-icon" [src]="spellIcon" alt="" />
        </div>
      } @else {
        <img class="card__art" [ngSrc]="artSrc()" [alt]="label()" [priority]="priority()" fill />
      }
      @if (header()) {
        <div class="card__header">
          <div class="card__header-icons">
            @if (showMana() && manaValue() > 0) {
              <span class="card__header-token card__header-token--mana" [class.card__header-token--mana-cost]="!!spell()" [attr.aria-label]="manaAria()">{{ manaValue() }}</span>
            }
            @if (showMana() && specialMana(); as type) {
              <span class="card__header-token card__header-token--special"
                    [class.card__header-token--special-prismatic]="type === 'prismatic'"
                    [class.card__header-token--special-vital]="type === 'vital'"
                    [class.card__header-token--special-chaotic]="type === 'chaotic'"
                    [style.--special-mana-icon]="specialManaIconUrl()"
                    role="img" [attr.aria-label]="specialManaAria()"></span>
            }
            <span class="card__header-token card__header-token--element">
              <img [src]="iconSrc()" alt="" aria-hidden="true" />
            </span>
          </div>
          <span class="card__header-label">{{ label() }}</span>
        </div>
      } @else {
        @if (showMana() && manaValue() > 0) {
          <span class="card__badge card__badge--mana" [class.card__badge--mana-cost]="!!spell()" [attr.aria-label]="manaAria()">{{ manaValue() }}</span>
        }
        @if (showMana() && specialMana(); as type) {
          <!-- Icona come maschera CSS (non un <img> a colore fisso): le SVG sorgente sono monocromatiche,
               la maschera le ricolora con currentColor in base al tipo (vedi le classi -prismatic/-vital/-chaotic). -->
          <span class="card__badge card__badge--special-mana"
                [class.card__badge--special-mana-prismatic]="type === 'prismatic'"
                [class.card__badge--special-mana-vital]="type === 'vital'"
                [class.card__badge--special-mana-chaotic]="type === 'chaotic'"
                [style.--special-mana-icon]="specialManaIconUrl()"
                role="img" [attr.aria-label]="specialManaAria()"></span>
        }
        @if (!spell()) {
          <img class="card__badge card__badge--element" [src]="iconSrc()" alt="" aria-hidden="true" />
        }
      }
    } @else {
      <img class="card__art card__art--back" ngSrc="/cards-back/dark.png" alt="" fill />
    }
  `,
  styleUrl: './card.component.scss',
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'height()',
    '[style.border-radius.px]': 'radius()',
    '[class.card--header-bottom]': "headerAlign() === 'bottom'",
    '[class.card--flipping]': 'flipping()',
    '(animationend)': 'flipping.set(false)',
  },
})
export class CardComponent {
  private readonly i18n = inject(TranslationService);

  readonly element = input.required<Element>();
  /** Card width in px. Height derives from the 2:3 portrait ratio. */
  readonly size = input<number>(40);
  /** Set on whichever card instance is expected to be the LCP element (e.g. the first hand card) — disables lazy loading and hints the browser to fetch it eagerly. */
  readonly priority = input<boolean>(false);
  /** Shows a compact icon+name header instead of the corner badges — for when the card is mostly hidden behind another element and only an edge peeks out. */
  readonly header = input<boolean>(false);
  /** Which edge the header bar is pinned to. */
  readonly headerAlign = input<'top' | 'bottom'>('top');
  /** Hides the Mana corner badge — for contexts where the card is rendered too small for it, or the cost is already shown elsewhere (e.g. the grimoire's formula cards). */
  readonly showMana = input<boolean>(true);
  /** Bonus manico (regolamento 1.4.3) permanently carried by this card instance — added on top of the element's base mana value. */
  readonly manaBonus = input<number>(0);
  /** Fronte (vero volto) o retro (carta coperta) — un cambiamento dopo il primo render fa scattare il flip simulato (vedi @keyframes card-flip). */
  readonly revealed = input<boolean>(true);
  /** Presente solo per una carta incantesimo (Card.spellId) — sovrascrive mana/etichetta/arte derivati da element() con quelli della Spell in SPELL_CATALOG (placeholder finché non esiste un'arte dedicata per incantesimo, vedi card__spell-bg/card__spell-token). */
  readonly spellId = input<string | null>(null);
  /** Mana speciale (regolamento 3.2) portato da questa carta — null per la stragrande maggioranza delle carte base. */
  readonly specialMana = input<SpecialMana | null>(null);

  /** Placeholder temporaneo per tutte le carte incantesimo — nessuna arte dedicata per singola Spell ancora. */
  protected readonly spellIcon = '/icons/wand_stars_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  /** Cosa mostra davvero il template in questo istante — resta indietro rispetto a revealed() finché il flip non raggiunge il suo punto invisibile (larghezza zero), cosicché lo scambio di volto non si veda. */
  protected readonly displayedRevealed = signal(this.revealed());
  protected readonly flipping = signal(false);
  /** Evita che il primo effect (sempre eseguito subito alla creazione) scambi il flip per un vero cambiamento. */
  private hasRunOnce = false;

  protected readonly height = computed(() => Math.round(this.size() * 1.5));
  protected readonly radius = computed(() => Math.min(Math.round(this.size() * 0.09), 10));
  protected readonly artSrc = computed(() => elementImagePath(this.element()));
  protected readonly iconSrc = computed(() => elementIconPath(this.element()));
  protected readonly spell = computed(() => {
    const id = this.spellId();
    return id ? (SPELL_CATALOG.find(s => s.id === id) ?? null) : null;
  });
  protected readonly label = computed(() => {
    const spell = this.spell();
    return spell ? this.i18n.t(`spells.${spell.id}.name`) : this.i18n.elementLabel(this.element());
  });
  protected readonly manaValue = computed(() => {
    const spell = this.spell();
    return spell ? spell.manaCost : ELEMENT_MANA[this.element()] + this.manaBonus();
  });
  protected readonly manaAria = computed(() => this.i18n.t('card.manaAria', { value: this.manaValue() }));
  protected readonly specialManaIcon = computed(() => {
    const type = this.specialMana();
    return type ? specialManaIconPath(type) : null;
  });
  /** CSS mask-image richiede il valore completo `url(...)`, non il solo path — separato da specialManaIcon() perché quest'ultimo può tornare utile altrove (es. un domani un <img> in un altro contesto). */
  protected readonly specialManaIconUrl = computed(() => {
    const icon = this.specialManaIcon();
    return icon ? `url(${icon})` : null;
  });
  protected readonly specialManaAria = computed(() => {
    const type = this.specialMana();
    return type ? this.i18n.t('card.specialManaAria', { name: this.i18n.specialManaLabel(type) }) : '';
  });

  constructor() {
    effect(onCleanup => {
      const next = this.revealed();
      if (!this.hasRunOnce) {
        this.hasRunOnce = true;
        return;
      }
      this.flipping.set(true);
      const timer = setTimeout(() => this.displayedRevealed.set(next), CARD_FLIP_HALF_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
