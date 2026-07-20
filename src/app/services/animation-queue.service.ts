import { DestroyRef, Injectable, inject, signal, type WritableSignal } from '@angular/core';
import type { GameState } from '../models/game.model';
import type { PlayerId } from '../models/player.model';
import type { Card } from '../models/card.model';
import type { GameEvent } from '../models/game-event.model';
import { deriveGameEvents } from '../game/derive-events';
import { AudioService } from './audio.service';
import type { DamageEvent } from '../components/player-hud/player-hud.component';

/** Durata dell'animazione di sparizione delle carte "temporanee" (Congelamento/Residuo,
 * Card.expiresAt) e della carta appena uscita dalla punta della bacchetta — deve combaciare con
 * @keyframes hand-card-vanish in board.component.scss. Esportata: board.component.ts la riusa per
 * allungare il ritardo di auto-avanzamento a Finale quando in mano c'è un Residuo in scadenza,
 * dandogli il tempo di sparire in vista prima che endTurn lo rimuova davvero. */
export const VANISH_DURATION_MS = 1000;
/** Durata del lampo + scossa sulle carte Luce/Tenebra coinvolte in un'Esplosione elementale (2.4) in
 * mano — deve combaciare con @keyframes hand-card-explode in board.component.scss. */
const EXPLOSION_GHOST_DURATION_MS = 700;
/** Durata del lampo + scossa sull'intera riga della Fonte Arcana per un'Esplosione elementale (2.4)
 * lì — deve combaciare con @keyframes fonte-explode in board.component.scss. */
const FONTE_EXPLOSION_DURATION_MS = 500;
/** Ritardo prima di rivelare il bonus manico (1.4.3) su una coppia appena pescata in Raccolta, per
 * farlo notare invece di mostrarlo già risolto. */
const COLLECT_BONUS_REVEAL_DELAY_MS = 900;
/** Ritardo prima del flip di rivelazione delle carte coinvolte in un'Esplosione elementale in mano,
 * per far leggere "ecco cos'è esploso" invece di mostrarle già scoperte di scatto. */
const HAND_EXPLOSION_REVEAL_DELAY_MS = 100;
/** Durata del flip (CardComponent, [revealed] false→true) — deve combaciare con CARD_FLIP_HALF_MS*2
 * in card.component.ts / @keyframes card-flip in card.component.scss. Il lampo/scossa
 * (EXPLOSION_GHOST_DURATION_MS) deve iniziare solo a flip concluso, mai in contemporanea: sono due
 * @keyframes distinte applicate allo stesso elemento (una dal CardComponent stesso via
 * card--flipping, una da board.component.scss via board__hand-card--exploding) — la proprietà CSS
 * `animation` non si somma tra due regole diverse, la seconda applicata sovrascrive semplicemente la
 * prima, quindi una delle due smetterebbe di vedersi se scattassero insieme. */
const CARD_FLIP_DURATION_MS = 300;
/** Durata trascurabile per far scattare una transizione CSS (margin-bottom) invece di un salto secco
 * quando una carta arriva nella punta/asta/manico della bacchetta. */
const WAND_ENTER_TRANSITION_MS = 20;

/** Carta "temporanea" già sparita dallo stato ma ancora mostrata come ghost, nella sua vecchia
 * posizione, finché l'animazione di sparizione non finisce — 'expiry' per Congelamento/Residuo
 * (Card.expiresAt, rilevata da un cardVanished event), 'toTip'/'toSocket' per un'azione deliberata
 * del giocatore (trattenuta alla punta, incastonata in asta/manico — marcata proattivamente da
 * BoardComponent PRIMA che lo stato grezzo cambi davvero, vedi addVanishingGhost). */
export interface VanishingGhost {
  card: Card;
  index: number;
  total: number;
  kind: 'expiry' | 'toTip' | 'toSocket';
}

export interface HandExplosion {
  role: PlayerId;
  cards: readonly Card[];
}

function roleRecord<T>(value: T): Record<PlayerId, T> {
  return { host: value, guest: value };
}

/**
 * Deriva e pilota le animazioni di transizione del gioco: prende ogni nuovo GameState grezzo
 * (BoardComponent lo passa a `sync` non appena arriva da Firestore) e lo confronta col precedente
 * via deriveGameEvents, mantenendo un piccolo set di segnali "overlay" effimeri che il template
 * consulta ACCANTO allo stato grezzo (mai al posto suo) per mostrare cosa sta sparendo/comparendo/
 * lampeggiando. Lo stato grezzo (hp, mano, mazzi...) resta sempre immediato — è così che le
 * animazioni già funzionanti in questo progetto (vanish ghost, flash esplosione) hanno sempre
 * operato: un valore vero aggiornato subito più un overlay temporaneo derivato da un diff, non un
 * secondo GameState "ritardato" in parallelo (che duplicherebbe lo stato senza risolvere altro).
 *
 * Fornito a livello di BoardComponent (non root, vedi providers nel @Component) — un'istanza per
 * sessione di partita, così `previousRaw` non sopravvive al cambio pagina e non confonde una
 * partita nuova con l'ultimo stato di quella precedente.
 */
@Injectable()
export class AnimationQueueService {
  private readonly audio = inject(AudioService);
  private readonly destroyRef = inject(DestroyRef);

  private previousRaw: GameState | null = null;
  private syncCounter = 0;
  /** true se il tab è stato in background (throttling dei timer del browser) da quando è stato
   * processato l'ultimo GameState — vedi sync(). */
  private hiddenSincePreviousSync = false;

  readonly vanishingCardIds = signal<ReadonlySet<string>>(new Set());
  readonly vanishingGhosts = signal<readonly VanishingGhost[]>([]);
  readonly handExplosions = signal<readonly HandExplosion[]>([]);
  /** Pilota SOLO il flip (CardComponent [revealed]) — mai lo shake, vedi handExplosionShaking. */
  readonly handExplosionRevealed = signal(false);
  /** Pilota SOLO il lampo/scossa (classe board__hand-card--exploding) — parte apposta dopo che il
   * flip pilotato da handExplosionRevealed è concluso, mai in contemporanea (vedi CARD_FLIP_DURATION_MS). */
  readonly handExplosionShaking = signal(false);
  readonly fonteExploding = signal(false);
  readonly revealedBonusIds = signal<ReadonlySet<string>>(new Set());
  private readonly tipEnteringByRole = signal<Record<PlayerId, boolean>>(roleRecord(false));
  private readonly tipVanishingByRole = signal<Record<PlayerId, Card | null>>(roleRecord(null));
  private readonly bodyEnteringByRole = signal<Record<PlayerId, boolean>>(roleRecord(false));
  private readonly handleEnteringByRole = signal<Record<PlayerId, boolean>>(roleRecord(false));
  private readonly damageEventByRole = signal<Record<PlayerId, DamageEvent | null>>(
    roleRecord(null),
  );

  constructor() {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') this.hiddenSincePreviousSync = true;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibilityChange),
    );
  }

  tipEnteringFor(role: PlayerId | null): boolean {
    return role ? this.tipEnteringByRole()[role] : false;
  }

  tipVanishingFor(role: PlayerId | null): Card | null {
    return role ? this.tipVanishingByRole()[role] : null;
  }

  bodyEnteringFor(role: PlayerId | null): boolean {
    return role ? this.bodyEnteringByRole()[role] : false;
  }

  handleEnteringFor(role: PlayerId | null): boolean {
    return role ? this.handleEnteringByRole()[role] : false;
  }

  damageEventFor(role: PlayerId | null): DamageEvent | null {
    return role ? this.damageEventByRole()[role] : null;
  }

  /** Marca proattivamente carte già in mano come "in sparizione imminente" (Residuo in scadenza a
   * Finale, regolamento 2.5/4.5) — usata dall'auto-avanzamento fase in BoardComponent PRIMA di
   * chiamare davvero endTurn, così l'animazione CSS gioca mentre la carta è ancora nell'array reale,
   * invece di dover ricorrere a un ghost quando sparirà per davvero (vedi onCardVanished sotto, che
   * la ripulisce senza crearne uno). */
  markExpiringSoon(cardIds: readonly string[]): void {
    if (cardIds.length === 0) return;
    this.vanishingCardIds.update((set) => new Set([...set, ...cardIds]));
  }

  /** Marca proattivamente una carta come "in sparizione" dalla mano PRIMA che lo stato grezzo la
   * rimuova davvero — usato dalle azioni dirette del giocatore (holdAtTip, socketElement) che sanno
   * già cosa sta per succedere, a differenza di una sparizione "di sorpresa" (Congelamento sciolto
   * nell'endTurn dell'avversario), rilevata invece da un cardVanished event via sync(). */
  addVanishingGhost(ghost: VanishingGhost): void {
    this.vanishingGhosts.update((list) => [...list, ghost]);
    const timer = setTimeout(() => {
      this.vanishingGhosts.update((list) => list.filter((g) => g.card.id !== ghost.card.id));
    }, VANISH_DURATION_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  /**
   * Chiamato da BoardComponent ogni volta che arriva un nuovo GameState grezzo da Firestore.
   * `myRole` filtra gli eventi bacchetta (tip/asta/manico), oggi animati solo per il proprio
   * pannello, mai per quello dell'avversario (board.component.html non lega mai tipEntering ecc. ai
   * pannelli opponentTip/Body/Handle).
   *
   * Se il salto rispetto all'ultimo GameState osservato è troppo grande per essere raccontato con
   * un'animazione sensata (più di un turno intero, o il tab era in background — reconnect dopo
   * assenza) non genera alcun evento: lo stato grezzo, letto altrove direttamente, mostra comunque
   * subito la situazione reale, semplicemente senza animarne la transizione.
   */
  sync(next: GameState, myRole: PlayerId | null): void {
    const prev = this.previousRaw;
    const stale = !!prev && (next.turnNumber - prev.turnNumber > 1 || this.hiddenSincePreviousSync);
    this.hiddenSincePreviousSync = false;
    this.previousRaw = next;

    if (!prev || stale) return;

    this.applyEvents(deriveGameEvents(prev, next), myRole);
  }

  private applyEvents(events: readonly GameEvent[], myRole: PlayerId | null): void {
    if (events.length === 0) return;
    this.syncCounter++;
    const damageId = this.syncCounter;

    // Un solo colpo di lampo+scossa anche quando più coppie esplodono nello stesso batch (2.4) —
    // sostituzione in blocco, non accodamento, stesso schema dell'effect che sostituiva.
    const explosions = events.filter(
      (e): e is Extract<GameEvent, { type: 'handExploded' }> => e.type === 'handExploded',
    );
    if (explosions.length > 0) {
      this.onHandExploded(explosions.map(({ role, cards }) => ({ role, cards })));
    }

    for (const event of events) {
      switch (event.type) {
        case 'cardsDrawn':
          this.audio.playFx('handDraw', { times: event.source === 'hand' ? 5 : 1 });
          break;
        case 'cardVanished':
          // vanishingGhosts/vanishingCardIds sono renderizzati SOLO nella sezione della propria mano
          // (board.component.html non ha un equivalente per quella dell'avversario) — senza questo
          // filtro, una Congelamento sciolta nella mano dell'AVVERSARIO produceva comunque un ghost,
          // mostrato per errore come se stesse sparendo dalla propria mano.
          if (event.role === myRole) this.onCardVanished(event.card, event.index, event.total);
          break;
        case 'handExploded':
          break; // già gestito in blocco sopra
        case 'fonteExploded':
          this.onFonteExploded();
          break;
        case 'fonteRevealed':
          this.audio.playFx('fonteReveal');
          break;
        case 'wandTipFilled':
          if (event.role === myRole) this.pulseEntering(this.tipEnteringByRole, event.role);
          break;
        case 'wandTipVanished':
          if (event.role === myRole) this.onWandTipVanished(event.role, event.card);
          break;
        case 'wandSocketFilled':
          if (event.role === myRole) {
            const target =
              event.slot === 'body' ? this.bodyEnteringByRole : this.handleEnteringByRole;
            this.pulseEntering(target, event.role);
          }
          break;
        case 'collectBonusRevealed':
          this.onCollectBonusRevealed(event.cardIds);
          break;
        case 'damageDealt':
          this.setDamageEvent(event.role, event.amount, damageId);
          break;
        case 'healed':
          break; // nessun overlay dedicato oggi (mai stato animato, nemmeno prima di questo refactor)
      }
    }
  }

  private onCardVanished(card: Card, index: number, total: number): void {
    const alreadyShown = this.vanishingCardIds();
    if (alreadyShown.has(card.id)) {
      // Già segnalata proattivamente (Residuo in scadenza a Finale, vedi l'effect di
      // auto-avanzamento in board.component.ts) — qui si ripulisce solo il flag, l'animazione ha
      // già giocato mentre la carta era ancora davvero in mano.
      this.vanishingCardIds.update((set) => {
        const next = new Set(set);
        next.delete(card.id);
        return next;
      });
      return;
    }

    // Sparizione "di sorpresa" (es. Congelamento sciolto nell'endTurn dell'avversario): nessun
    // "prima" da cui animare, resta come ghost nella sua vecchia posizione.
    this.vanishingGhosts.update((list) => [...list, { card, index, total, kind: 'expiry' }]);
    const timer = setTimeout(() => {
      this.vanishingGhosts.update((list) => list.filter((g) => g.card.id !== card.id));
    }, VANISH_DURATION_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  private onHandExploded(explosions: readonly HandExplosion[]): void {
    this.handExplosions.set(explosions);
    this.handExplosionRevealed.set(false);
    this.handExplosionShaking.set(false);

    const revealTimer = setTimeout(
      () => this.handExplosionRevealed.set(true),
      HAND_EXPLOSION_REVEAL_DELAY_MS,
    );
    this.destroyRef.onDestroy(() => clearTimeout(revealTimer));

    // Lo shake parte solo a flip concluso, mai in contemporanea (vedi CARD_FLIP_DURATION_MS).
    const shakeTimer = setTimeout(
      () => this.handExplosionShaking.set(true),
      HAND_EXPLOSION_REVEAL_DELAY_MS + CARD_FLIP_DURATION_MS,
    );
    this.destroyRef.onDestroy(() => clearTimeout(shakeTimer));

    const clearTimer = setTimeout(
      () => {
        this.handExplosions.set([]);
        this.handExplosionRevealed.set(false);
        this.handExplosionShaking.set(false);
      },
      HAND_EXPLOSION_REVEAL_DELAY_MS + CARD_FLIP_DURATION_MS + EXPLOSION_GHOST_DURATION_MS,
    );
    this.destroyRef.onDestroy(() => clearTimeout(clearTimer));
  }

  private onFonteExploded(): void {
    this.fonteExploding.set(true);
    const timer = setTimeout(() => this.fonteExploding.set(false), FONTE_EXPLOSION_DURATION_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  private onWandTipVanished(role: PlayerId, card: Card): void {
    this.tipVanishingByRole.update((rec) => ({ ...rec, [role]: card }));
    const timer = setTimeout(() => {
      this.tipVanishingByRole.update((rec) => ({ ...rec, [role]: null }));
    }, VANISH_DURATION_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  private pulseEntering(target: WritableSignal<Record<PlayerId, boolean>>, role: PlayerId): void {
    target.update((rec) => ({ ...rec, [role]: true }));
    const timer = setTimeout(
      () => target.update((rec) => ({ ...rec, [role]: false })),
      WAND_ENTER_TRANSITION_MS,
    );
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  private onCollectBonusRevealed(cardIds: readonly string[]): void {
    const timer = setTimeout(() => {
      this.revealedBonusIds.update((set) => new Set([...set, ...cardIds]));
    }, COLLECT_BONUS_REVEAL_DELAY_MS);
    this.destroyRef.onDestroy(() => clearTimeout(timer));
  }

  private setDamageEvent(role: PlayerId, amount: number, id: number): void {
    this.damageEventByRole.update((rec) => ({ ...rec, [role]: { id, amount } }));
  }
}
