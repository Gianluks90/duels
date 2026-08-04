import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  inject,
  signal,
  effect,
  DestroyRef,
  type Signal,
} from '@angular/core';
import { firstNameOf, type Health } from '../../models/player.model';
import { elementIconPath, type Element } from '../../models/element.model';
import { TooltipDirective } from '../ui/tooltip/tooltip.directive';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Durata del pulse/numero fluttuante quando arriva un FlashEvent (danno, cura o scudo) — deve
 * combaciare con @keyframes hud-damage-number/hp-damage-flash in player-hud.component.scss. */
const FLASH_DURATION_MS = 1000;

/** Una variazione da mostrare una tantum (danno subito, cura ricevuta, scudo guadagnato) — `id` deve
 * cambiare solo quando è successo davvero qualcosa di nuovo (il contatore interno di
 * AnimationQueueService), non a ogni render. */
export interface FlashEvent {
  id: number;
  amount: number;
}

/** Un elemento della formula di una magia pinnata, già risolto per il tooltip — `available` dice se
 * QUELL'elemento ha almeno una carta corrispondente in mano+mazzo+scarti (countMatchingCards,
 * turn-engine.ts), calcolato in board.component.ts. */
export interface PinnedSpellFormulaItem {
  element: Element;
  available: boolean;
}

/** Una magia "appuntata" già risolta per la UI — vedi board.component.ts, che unisce
 * PinnedSpellsService con SPELL_CATALOG e countMatchingCards/hasElements (turn-engine.ts) per
 * costruirla. player-hud resta presentazionale, nessuna di quella logica qui. */
export interface PinnedSpellInfo {
  spellId: string;
  name: string;
  formula: readonly PinnedSpellFormulaItem[];
  /** true se l'INTERA formula è ricomponibile da mano+mazzo+scarti insieme (hasElements) — il badge
   * stesso diventa verde quando true. */
  available: boolean;
}

@Component({
  selector: 'app-player-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective, TranslatePipe],
  templateUrl: './player-hud.component.html',
  styleUrl: './player-hud.component.scss',
})
export class PlayerHudComponent {
  protected readonly i18n = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly name = input.required<string>();
  readonly health = input.required<Health>();
  readonly mirrored = input<boolean>(false);
  /** true se è il turno di questo giocatore — mostra un bordo dorato acceso sul pannello (unico indicatore di turno rimasto, dopo la rimozione del nome dal phase-tracker). */
  readonly active = input<boolean>(false);
  readonly width = input<number>(264);
  /** Google account photo (GameDoc.hostPhoto/guestPhoto) — null shows the name's initial instead, same fallback as the home page avatar. */
  readonly photoUrl = input<string | null>(null);
  /** Livello di Avvelenamento (0–3, regolamento 2.3.4) — un teschio per livello, accanto al valore di vita. */
  readonly poisonLevel = input<number>(0);
  /** true finché il giocatore ha ancora carte Congelamento non sciolte in circolazione (mano, mazzo o scarti — regolamento 2.3.1). */
  readonly frozen = input<boolean>(false);
  /** Nomi tradotti delle magie preferite di QUESTO giocatore (Qualità della vita) — reciproco: sia il
   * proprio pannello sia quello dell'avversario lo ricevono, a differenza di pinnedSpells (solo
   * proprio). Vuoto finché il profilo/GameDoc non è ancora arrivato o l'utente non ha preferiti. */
  readonly favoriteSpellNames = input<readonly string[]>([]);
  /** Titolo equipaggiato di QUESTO giocatore, già risolto in testo (board.component.ts, via
   * TranslationService.titleLabel — GameDoc.hostTitle/guestTitle sono variant-id, non testo pronto).
   * Reciproco come favoriteSpellNames sopra. Null finché non equipaggiato (profili creati prima di
   * questa feature) o non ancora arrivato. Chiamato `equippedTitle`, non `title`: quest'ultimo è già
   * l'attributo HTML nativo (tooltip), da non confondere con un @Component input. */
  readonly equippedTitle = input<string | null>(null);
  /** Magie appuntate per QUESTA partita (Qualità della vita) — a differenza di favoriteSpellNames,
   * solo il pannello PROPRIO le riceve (board.component.html non le passa a quello dell'avversario):
   * sono un promemoria privato, non visibile all'altro giocatore. */
  readonly pinnedSpells = input<readonly PinnedSpellInfo[]>([]);
  /** Colpo subito da segnalare (danno da incantesimo) — funziona anche quando la causa non è visibile a schermo (es. nella mano coperta dell'avversario), dato che qui basta sapere "quanto" e "quando", non "perché". */
  readonly damageEvent = input<FlashEvent | null>(null);
  /** Cura ricevuta da segnalare (es. Rigenerazione) — stesso schema di damageEvent. */
  readonly healEvent = input<FlashEvent | null>(null);
  /** Scudo guadagnato da segnalare (2.3.3) — stesso schema di damageEvent, solo per gli AUMENTI (vedi derive-events.ts). */
  readonly shieldEvent = input<FlashEvent | null>(null);
  /** Danno da Avvelenamento (2.3.4) da segnalare — stesso schema di damageEvent, ma con propria icona/colore (teschio verde invece del lampo rosso generico), già scorporato dal danno generico lato AnimationQueueService. */
  readonly poisonDamageEvent = input<FlashEvent | null>(null);

  /** Only rendered when !mirrored() — the opponent's panel has no settings button. */
  readonly settingsClick = output<void>();

  /** null finché non c'è una variazione da mostrare; altrimenti l'ammontare, per il tempo dell'animazione. */
  protected readonly activeDamageAmount = this.watchFlashEvent(this.damageEvent);
  protected readonly activeHealAmount = this.watchFlashEvent(this.healEvent);
  protected readonly activeShieldAmount = this.watchFlashEvent(this.shieldEvent);
  protected readonly activePoisonDamageAmount = this.watchFlashEvent(this.poisonDamageEvent);

  /** Un solo effect per FlashEvent (danno/cura/scudo condividono lo stesso schema: mostra
   * l'ammontare finché non scade il timer, dedup sull'id) invece di triplicare il costruttore —
   * chiamato dai field initializer sopra, ancora dentro il contesto di injection del componente. */
  private watchFlashEvent(eventInput: () => FlashEvent | null): Signal<number | null> {
    const active = signal<number | null>(null);
    let lastEventId: number | null = null;

    effect(() => {
      const event = eventInput();
      if (!event || event.id === lastEventId) return;
      lastEventId = event.id;

      active.set(event.amount);
      const timer = setTimeout(() => active.set(null), FLASH_DURATION_MS);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    });

    return active.asReadonly();
  }

  protected readonly poisonIcon = elementIconPath('poison');
  protected readonly poisonRange = computed(() =>
    Array.from({ length: this.poisonLevel() }, (_, i) => i),
  );
  protected readonly isPoisoned = computed(() => this.poisonLevel() > 0);

  protected readonly firstName = computed(() => firstNameOf(this.name()));
  protected readonly avatarInitial = computed(() => (this.name().charAt(0) || '?').toUpperCase());

  /** Normally == max, so the bar behaves exactly as before; only stretches when shield pushes the total past max, so the shield segment is never clipped. */
  private readonly totalUnits = computed(() =>
    Math.max(this.health().max, this.health().current + this.health().shield),
  );

  protected readonly hpPercent = computed(() => this.percentOf(this.health().current));
  protected readonly shieldPercent = computed(() => this.percentOf(this.health().shield));
  protected readonly hasShield = computed(() => this.health().shield > 0);

  /** The number shown above the bar merges current + shield — the tooltip (only present when there's a shield) spells out the breakdown. */
  protected readonly displayedHp = computed(() => this.health().current + this.health().shield);

  protected readonly hpAria = computed(() =>
    this.i18n.t('playerHud.hpAria', {
      name: this.firstName(),
      value: this.displayedHp(),
      max: this.health().max,
    }),
  );

  protected readonly poisonAria = computed(() =>
    this.i18n.t('playerHud.poisonAria', { level: this.poisonLevel() }),
  );
  protected readonly frozenAria = computed(() => this.i18n.t('playerHud.frozenAria'));

  protected readonly favoritesTooltip = computed<string | null>(() => {
    const names = this.favoriteSpellNames();
    return names.length > 0
      ? this.i18n.t('playerHud.favoritesTooltip', { names: names.join(', ') })
      : null;
  });

  protected readonly hpTooltip = computed(() => {
    const { current, shield } = this.health();
    return shield > 0
      ? this.i18n.t('playerHud.hpTooltip', { current, shield, total: current + shield })
      : null;
  });

  private percentOf(value: number): number {
    const pct = (value / this.totalUnits()) * 100;
    return Math.max(0, Math.min(100, pct));
  }
}
