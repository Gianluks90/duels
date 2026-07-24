import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { Element } from '../../models/element.model';
import { elementImagePath, elementIconPath, ELEMENT_MANA } from '../../models/element.model';
import type { SpecialMana } from '../../models/card.model';
import { specialManaIconPath, REVEALED_ICON } from '../../models/card.model';
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
        <!-- Incantesimo (regolamento 5): full art come le carte elemento (card__art sotto), niente
             più il vecchio schema "arte sopra, riquadro sotto" — l'icona bacchetta-stelle si sposta
             nel badge card__badge--spell (stesso trattamento del mana speciale, poco sotto il costo
             mana). L'arte è /cards-spell/{{ id spell }}.webp se esiste (assets-source/cards-spell/,
             vedi scripts/optimize-images.mjs), altrimenti il placeholder condiviso book.webp —
             nessuna lista da mantenere in codice: onSpellArtError() scatta sul 404 e fa ripiegare sul
             placeholder, così una nuova arte diventa visibile semplicemente droppando il file (nome
             = id magia) e rilanciando lo script, senza toccare questo componente. -->
        <img
          class="card__art"
          [ngSrc]="spellArtSrc()"
          [alt]="label()"
          [priority]="priority()"
          (error)="onSpellArtError()"
          fill
        />
      } @else {
        <img class="card__art" [ngSrc]="artSrc()" [alt]="label()" [priority]="priority()" fill />
        @if (freeze()) {
          <!-- Congelamento (2.3.1): non-carta, nessun angolo/header — solo l'arte Ghiaccio (element='ice',
               vedi applyFreeze in turn-engine.ts) con un gettone grosso centrato al posto del badge piccolo. -->
          <div class="card__freeze-token" aria-hidden="true">
            <img class="card__freeze-icon" [src]="iconSrc()" alt="" />
          </div>
        }
      }
      @if (!freeze()) {
        @if (header()) {
          <div class="card__header">
            <div class="card__header-icons">
              @if (showMana() && manaValue() > 0) {
                <span
                  class="card__header-token card__header-token--mana"
                  [class.card__header-token--mana-cost]="!!spell()"
                  [attr.aria-label]="manaAria()"
                  >{{ manaValue() }}</span
                >
              }
              @if (showMana() && specialMana(); as type) {
                <span
                  class="card__header-token card__header-token--special"
                  [class.card__header-token--special-prismatic]="type === 'prismatic'"
                  [class.card__header-token--special-vital]="type === 'vital'"
                  [class.card__header-token--special-chaotic]="type === 'chaotic'"
                  [style.--special-mana-icon]="specialManaIconUrl()"
                  role="img"
                  [attr.aria-label]="specialManaAria()"
                ></span>
              }
              <span class="card__header-token card__header-token--element">
                <img [src]="iconSrc()" alt="" aria-hidden="true" />
              </span>
            </div>
            <span class="card__header-label">{{ label() }}</span>
          </div>
        } @else {
          @if (showMana() && manaValue() > 0) {
            <span
              class="card__badge card__badge--mana"
              [class.card__badge--mana-cost]="!!spell()"
              [attr.aria-label]="manaAria()"
              >{{ manaValue() }}</span
            >
          }
          @if (showMana() && specialMana(); as type) {
            <!-- Icona come maschera CSS (non un <img> a colore fisso): le SVG sorgente sono monocromatiche,
                 la maschera le ricolora con currentColor in base al tipo (vedi le classi -prismatic/-vital/-chaotic). -->
            <span
              class="card__badge card__badge--special-mana"
              [class.card__badge--special-mana-prismatic]="type === 'prismatic'"
              [class.card__badge--special-mana-vital]="type === 'vital'"
              [class.card__badge--special-mana-chaotic]="type === 'chaotic'"
              [style.--special-mana-icon]="specialManaIconUrl()"
              role="img"
              [attr.aria-label]="specialManaAria()"
            ></span>
          }
          @if (showMana() && spell()) {
            <!-- Icona incantesimo — stesso slot/dimensione del mana speciale sopra (mai insieme:
                 una carta è o un elemento base, o un incantesimo, mai entrambi), ma un semplice
                 <img> a colore fisso invece della maschera CSS: un solo stato, non serve
                 ricolorare per tipo come prismatico/vitale/caotico. -->
            <img class="card__badge card__badge--spell" [src]="spellIcon" alt="" aria-hidden="true" />
          }
          @if (showMana() && revealedToOpponent()) {
            <!-- Occhio (5.x, Card.revealedToOpponent) — stesso gettone/tecnica maschera di
                 card__badge--special-mana sopra, ma grigio e senza varianti (un solo stato, non 3
                 tipi da colorare). "In coda" alla colonna: sotto il mana speciale/l'icona incantesimo
                 se presenti, sennò nello stesso slot che occuperebbero loro. Solo visivo + aria-label,
                 come il badge del mana speciale sopra — il tooltip ricco (titolo/icona, hr,
                 descrizione) è responsabilità del chiamante (#revealedTip in
                 board.component.html/pile-dialog), non di questo componente: deve poter
                 convivere/combinarsi con lo spellTip/specialManaTip ecc. già gestiti lì, cosa che un
                 tooltip proprio qui dentro non potrebbe fare. -->
            <span
              class="card__badge card__badge--revealed"
              [class.card__badge--revealed-after-special]="!!specialMana() || !!spell()"
              [style.--revealed-icon]="revealedIconUrl"
              role="img"
              [attr.aria-label]="revealedAria()"
            ></span>
          }
          @if (!spell()) {
            <img
              class="card__badge card__badge--element"
              [src]="iconSrc()"
              alt=""
              aria-hidden="true"
            />
          }
          @if (heldAtTip()) {
            <img
              class="card__badge card__badge--tip"
              [src]="spellIcon"
              [attr.aria-label]="heldAtTipAria()"
            />
          }
        }
      }
    } @else {
      <img class="card__art card__art--back" ngSrc="/cards-back/dark.webp" alt="" fill />
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
  /** Presente solo per una carta incantesimo (Card.spellId) — sovrascrive mana/etichetta/arte derivati da element() con quelli della Spell in SPELL_CATALOG (arte da spellArtSrc(), vedi sotto). */
  readonly spellId = input<string | null>(null);
  /** Mana speciale (regolamento 3.2) portato da questa carta — null per la stragrande maggioranza delle carte base. */
  readonly specialMana = input<SpecialMana | null>(null);
  /** Carta Congelamento (Card.tier 'freeze', regolamento 2.3.1) — mostra un gettone grosso centrato con l'icona elemento al posto del badge d'angolo/header, sull'arte dell'elemento passato in element() (sempre 'ice', vedi applyFreeze). */
  readonly freeze = input<boolean>(false);
  /** Card.revealedToOpponent (5.x, Terzo occhio/Occhio supremo) — questa carta è stata rivelata permanentemente all'avversario del suo proprietario. Chi la vede così è appunto l'avversario: sul proprio pannello del giocatore questo input non viene mai passato true (non ha senso rivelarsi da soli qualcosa che già si vede). */
  readonly revealedToOpponent = input<boolean>(false);
  /** true se questa carta è quella attualmente trattenuta nella punta della bacchetta (1.4.1) — solo per contesti dove compare mischiata ad altre carte pagabili/scelte senza nessun'altra indicazione visiva che lo distingua (es. cast-spell dialog, dove conta come mano ma non ci sta fisicamente). Badge nell'angolo in basso a sinistra, l'unico ancora libero (mana/mana speciale in alto a sinistra, elemento in basso a destra). */
  readonly heldAtTip = input<boolean>(false);

  /** Placeholder temporaneo per tutte le carte incantesimo — nessuna arte dedicata per singola Spell ancora. */
  protected readonly spellIcon = '/icons/wand_stars_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly revealedIconUrl = `url(${REVEALED_ICON})`;

  /** Cosa mostra davvero il template in questo istante — resta indietro rispetto a revealed() finché il flip non raggiunge il suo punto invisibile (larghezza zero), cosicché lo scambio di volto non si veda. Inizializzato al default dell'input (true): i field initializer girano nel costruttore, PRIMA che Angular applichi il binding reale di revealed() (che arriva solo nel primo giro di change detection successivo) — se il chiamante monta la carta già con revealed=false, questo valore iniziale è quindi sbagliato finché il primo effect() sotto non lo corregge. */
  protected readonly displayedRevealed = signal(this.revealed());
  protected readonly flipping = signal(false);
  /** Il primo giro dell'effect sotto non è un vero cambiamento (nessun volto precedente da cui animare il flip) ma DEVE comunque sincronizzare displayedRevealed con l'input reale — saltarlo del tutto (come faceva prima) lascia la carta bloccata sul default `true` del field initializer quando monta già coperta (revealed=false sin dall'inizio), mostrando per errore il volto vero di una carta che non dovrebbe mai essere visibile (es. mazzo coperto dell'avversario in pile-dialog). */
  private hasRunOnce = false;

  protected readonly height = computed(() => Math.round(this.size() * 1.5));
  protected readonly radius = computed(() => Math.min(Math.round(this.size() * 0.09), 10));
  protected readonly artSrc = computed(() => elementImagePath(this.element()));
  protected readonly iconSrc = computed(() => elementIconPath(this.element()));
  protected readonly spell = computed(() => {
    const id = this.spellId();
    return id ? (SPELL_CATALOG.find((s) => s.id === id) ?? null) : null;
  });
  /** true dopo un 404 su /cards-spell/{id}.webp — niente reset al variare di spellId(): ogni carta è
   * tracciata per Card.id (univoco anche tra copie della stessa magia, vedi board.component.html),
   * quindi questa istanza di CardComponent non cambia mai magia nel corso della sua vita. */
  protected readonly spellArtFailed = signal(false);
  protected readonly spellArtSrc = computed(() => {
    const spell = this.spell();
    return spell && !this.spellArtFailed()
      ? `/cards-spell/${spell.id}.webp`
      : '/images/book.webp';
  });
  protected readonly label = computed(() => {
    const spell = this.spell();
    return spell ? this.i18n.t(`spells.${spell.id}.name`) : this.i18n.elementLabel(this.element());
  });
  protected readonly manaValue = computed(() => {
    const spell = this.spell();
    return spell ? spell.manaCost : ELEMENT_MANA[this.element()] + this.manaBonus();
  });
  protected readonly manaAria = computed(() =>
    this.i18n.t('card.manaAria', { value: this.manaValue() }),
  );
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
    return type
      ? this.i18n.t('card.specialManaAria', { name: this.i18n.specialManaLabel(type) })
      : '';
  });
  protected readonly revealedAria = computed(() => this.i18n.t('card.revealed.title'));
  protected readonly heldAtTipAria = computed(() => this.i18n.t('card.heldAtTipAria'));

  protected onSpellArtError(): void {
    this.spellArtFailed.set(true);
  }

  constructor() {
    effect((onCleanup) => {
      const next = this.revealed();
      if (!this.hasRunOnce) {
        this.hasRunOnce = true;
        this.displayedRevealed.set(next);
        return;
      }
      if (next === this.displayedRevealed()) return;
      this.flipping.set(true);
      const timer = setTimeout(() => this.displayedRevealed.set(next), CARD_FLIP_HALF_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
