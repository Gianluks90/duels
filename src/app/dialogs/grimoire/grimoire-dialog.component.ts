import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import type { Element } from '../../models/element.model';
import { elementIconPath } from '../../models/element.model';
import type { Card } from '../../models/card.model';
import type { PlayerId } from '../../models/player.model';
import { CardComponent } from '../../components/card/card.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { SelectComponent, type SelectOption } from '../../components/ui/select/select.component';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { GameEngineService } from '../../services/game-engine.service';
import { BoardLayoutService } from '../../services/board-layout.service';
import type { Spell } from '../../models/spell.model';
import { SPELL_CATALOG } from '../../data/spells';
import { hasElements } from '../../game/turn-engine';

/** Tutti i campi opzionali: il Grimorio si apre anche fuori da una partita (Home, "solo per sfogliare le magie", vedi home.component.ts) — in quel caso non c'è né una mano né un gameId/role a cui agganciare "Crea", e la dialog deve degradare a semplice consultazione invece di lanciare un errore su `undefined`. */
export interface GrimoireDialogData {
  gameId?: string;
  role?: PlayerId;
  /** Mano del giocatore, comprensiva dell'eventuale carta nella punta della bacchetta (1.4.1) — istantanea presa all'apertura, come per gli altri dialog di azione (es. CastSpellDialogData.payableHand). Assente fuori da una partita: creatable() tratta "nessuna mano" come "nessun elemento", quindi nessuna magia risulta creabile. */
  hand?: readonly Card[];
  /** true se il giocatore è di turno ed è in fase Azione (5.1) — determina se il bottone "Crea" può essere premuto ora, a prescindere dall'etichetta "creabile" (che riflette solo il possesso degli elementi, vedi creatable()). Assente (quindi mai vero) fuori da una partita. */
  canCreate?: boolean;
}

// Residuo Arcano excluded on purpose — it's a wildcard, not an element, and no
// spell formula involves it (for now).
const FILTER_ELEMENTS: readonly Element[] = [
  'fire',
  'water',
  'air',
  'earth',
  'thunder',
  'ice',
  'poison',
  'lava',
  'light',
  'dark',
];

type SortOption = 'alpha-asc' | 'alpha-desc' | 'cost-asc' | 'cost-desc';

@Component({
  selector: 'app-grimoire-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconButtonComponent, SelectComponent, TranslatePipe],
  templateUrl: './grimoire-dialog.component.html',
  styleUrl: './grimoire-dialog.component.scss',
})
export class GrimoireDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  // config.data è undefined quando la dialog si apre senza passare `data` (Home, vedi
  // GrimoireDialogData) — CDK Dialog inietta comunque DIALOG_DATA con quel valore letterale, non lo
  // rifiuta né lo sostituisce con un default proprio. `?? {}` qui è l'unico punto che deve saperlo:
  // il resto del componente lavora su un GrimoireDialogData sempre presente, dai campi opzionali.
  private readonly data = inject<GrimoireDialogData | undefined>(DIALOG_DATA) ?? {};
  private readonly gameEngine = inject(GameEngineService);
  private readonly boardLayout = inject(BoardLayoutService);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly elementIconPath = elementIconPath;
  protected readonly filterElements = FILTER_ELEMENTS;

  /** Sotto i 1024px (stessa soglia di BoardLayoutService) le due pagine affiancate non hanno più
   * spazio per stare fianco a fianco — sotto quella soglia il libro si impila in verticale, pagina
   * sinistra (filtri + elenco, altezza ridotta a un paio di righe) sopra la pagina destra (dettaglio),
   * niente più salto tra "elenco" e "dettaglio" come farebbe un side-nav che sostituisce la pagina. */
  protected readonly compact = computed(() => this.boardLayout.tier() !== 'desktop');

  // 'starter_bolt' (una delle 2 magie base sempre note, 5.1 — formula vuota, mai creata) come default
  // invece di SPELL_CATALOG[0]: quello era semplicemente il primo elemento nell'ordine di
  // DICHIARAZIONE del catalogo (fire_bolt), che non ha alcuna relazione con l'ordine ALFABETICO
  // mostrato di default nell'elenco (filteredSpells, sortOption 'alpha-asc') — il cursore finiva
  // quindi quasi sempre su una magia a metà/fine lista invece che in cima, a ogni apertura.
  protected readonly selectedSpellId = signal<string>('starter_bolt');
  protected readonly creating = signal(false);

  /** Filtro elemento (5.1) — inclusivo/OR: una magia compare se la sua formula contiene ALMENO UNO degli elementi attivi (vedi filteredSpells sotto), non tutti. Set vuoto = nessun filtro, mostra tutto. */
  protected readonly activeFilters = signal<ReadonlySet<Element>>(new Set());
  protected readonly sortOption = signal<SortOption>('alpha-asc');
  protected readonly onlyCreatable = signal(false);

  protected readonly sortOptions = computed<SelectOption<SortOption>[]>(() => [
    { value: 'alpha-asc', label: this.i18n.t('grimoire.sortAlphaAsc') },
    { value: 'alpha-desc', label: this.i18n.t('grimoire.sortAlphaDesc') },
    { value: 'cost-asc', label: this.i18n.t('grimoire.sortCostAsc') },
    { value: 'cost-desc', label: this.i18n.t('grimoire.sortCostDesc') },
  ]);

  /** Catalogo intero ordinato alfabeticamente, indipendente da filtri/ordinamento correnti — usato solo per la numerazione di pagina (5, "un libro"): la pagina di una magia non cambia mentre sfogli/filtri, cambierebbe solo con la lingua (il nome tradotto è il criterio d'ordine). */
  private readonly bookOrder = computed<Spell[]>(() =>
    [...SPELL_CATALOG].sort((a, b) => this.spellName(a).localeCompare(this.spellName(b))),
  );

  protected readonly totalSpellCount = SPELL_CATALOG.length;

  protected readonly filteredSpells = computed<Spell[]>(() => {
    const active = this.activeFilters();
    let list =
      active.size === 0
        ? [...SPELL_CATALOG]
        : SPELL_CATALOG.filter((s) => s.formula.some((el) => active.has(el)));

    if (this.onlyCreatable()) list = list.filter((s) => this.creatable(s));

    const sort = this.sortOption();
    list.sort((a, b) => {
      if (sort === 'cost-asc') return a.manaCost - b.manaCost;
      if (sort === 'cost-desc') return b.manaCost - a.manaCost;
      const cmp = this.spellName(a).localeCompare(this.spellName(b));
      return sort === 'alpha-desc' ? -cmp : cmp;
    });

    return list;
  });

  protected readonly selectedSpell = computed<Spell | null>(
    () => SPELL_CATALOG.find((s) => s.id === this.selectedSpellId()) ?? null,
  );

  /** true se /cards-spell/{id}.webp ha risposto 404 per la magia SELEZIONATA ORA — a differenza di
   * CardComponent (un'istanza per carta, mai riciclata tra magie diverse), qui lo stesso <img> nel
   * DOM viene riusato al cambio di selectedSpellId(): l'effect sotto lo resetta a `false` a ogni
   * cambio, altrimenti l'esito della magia precedente resterebbe appiccicato a quella nuova (nasconde
   * la sezione anche quando la nuova magia ha davvero un'illustrazione, o viceversa la mostra un
   * istante di troppo). */
  protected readonly illustrationFailed = signal(false);

  constructor() {
    effect(() => {
      this.selectedSpellId();
      this.illustrationFailed.set(false);
    });
  }

  protected illustrationSrc(spell: Spell): string {
    return `/cards-spell/${spell.id}.webp`;
  }

  protected onIllustrationError(): void {
    this.illustrationFailed.set(true);
  }

  protected toggleFilter(element: Element): void {
    this.activeFilters.update((prev) => {
      const next = new Set(prev);
      if (next.has(element)) next.delete(element);
      else next.add(element);
      return next;
    });
  }

  protected setSortOption(option: SortOption): void {
    this.sortOption.set(option);
  }

  protected setOnlyCreatable(checked: boolean): void {
    this.onlyCreatable.set(checked);
  }

  protected selectSpell(id: string): void {
    this.selectedSpellId.set(id);
  }

  /** Posizione (1-based) della magia nel catalogo completo ordinato alfabeticamente — vedi bookOrder. */
  protected pageNumber(spell: Spell): number {
    return this.bookOrder().findIndex((s) => s.id === spell.id) + 1;
  }

  /** Regolamento 5.1: hai gli elementi per produrre questa magia — solo possesso, non tiene conto di turno/fase (vedi canCreateSpell per quello). Sempre false per le magie a formula vuota (starter_bolt/starter_balm), mai creabili: seminate direttamente nel mazzo iniziale. Sempre false anche fuori da una partita (data.hand assente, vedi GrimoireDialogData) — nessuna mano da cui possedere elementi. */
  protected creatable(spell: Spell): boolean {
    return spell.formula.length > 0 && hasElements(this.data.hand ?? [], spell.formula);
  }

  /** Il bottone "Crea" richiede sia gli elementi (creatable) sia di essere di turno in fase Azione (data.canCreate) — a differenza dell'etichetta "creabile" nell'elenco, che mostra solo il primo. Sempre false fuori da una partita (data.canCreate assente). */
  protected canCreateSpell(spell: Spell): boolean {
    return !!this.data.canCreate && this.creatable(spell);
  }

  protected async createSpell(spell: Spell): Promise<void> {
    // gameId/role sono garantiti presenti qui: canCreateSpell() richiede data.canCreate, mai vero
    // fuori da una partita (vedi sopra) — quindi il bottone "Crea" che chiama questo metodo non è
    // mai raggiungibile senza di essi.
    if (!this.canCreateSpell(spell) || this.creating() || !this.data.gameId || !this.data.role)
      return;
    this.creating.set(true);
    try {
      await this.gameEngine.createSpell(this.data.gameId, this.data.role, spell.id);
      this.dialogRef.close();
    } finally {
      this.creating.set(false);
    }
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

  /** Regolamento 1.4.2: quando la magia appartiene a un elemento (Spell.element — assente per gli incantesimi "neutri"), il danno inflitto lo indica nel testo stesso ("Infligge 1 danno da Fuoco...") invece che con un badge separato — è quel testo a determinare se l'asta di chi lo subisce dà resistenza/vulnerabilità. */
  protected effectLabel(spell: Spell): string {
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
            return spell.element
              ? this.i18n.t('grimoire.effects.damageSelfElement', {
                  amount,
                  element: this.i18n.elementLabel(spell.element),
                })
              : this.i18n.t('grimoire.effects.damageSelf', { amount });
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

  protected close(): void {
    this.dialogRef.close();
  }
}
