import { Injectable, signal, type Signal, type WritableSignal } from '@angular/core';

const STORAGE_PREFIX = 'duels.pinnedSpells.';

/** Numero massimo di incantesimi appuntabili per singola partita (Qualità della vita). */
export const MAX_PINNED_SPELLS = 5;

/**
 * Magie "appuntate" (bookmark) durante una partita — a differenza dei preferiti (UserProfile,
 * account-level, visibili all'avversario), i pin sono privati e legati a UNA sola partita: niente
 * Firestore, solo `localStorage` chiavato per gameId (stesso schema `duels.<dominio>` di
 * AudioService/BackgroundService). `providedIn: 'root'` (non component-scoped su BoardComponent)
 * perché GrimoireDialogComponent viene aperto da `dialog.open()` senza un injector custom
 * (board.component.ts `openGrimoire()`) — un servizio component-scoped non sarebbe raggiungibile da
 * lì, stesso motivo per cui GameEngineService è root e prende `gameId` come parametro esplicito.
 */
@Injectable({ providedIn: 'root' })
export class PinnedSpellsService {
  private readonly stateByGame = new Map<string, WritableSignal<string[]>>();

  pinned(gameId: string): Signal<readonly string[]> {
    return this.stateFor(gameId).asReadonly();
  }

  isPinned(gameId: string, spellId: string): boolean {
    return this.stateFor(gameId)().includes(spellId);
  }

  /** false solo quando si è già al limite di MAX_PINNED_SPELLS e questa magia non è tra quelle
   * pinnate — stessa semantica di canToggleFavorite (AuthService). */
  canToggle(gameId: string, spellId: string): boolean {
    const current = this.stateFor(gameId)();
    return current.includes(spellId) || current.length < MAX_PINNED_SPELLS;
  }

  toggle(gameId: string, spellId: string): void {
    if (!this.canToggle(gameId, spellId)) return;

    const current = this.stateFor(gameId)();
    const next = current.includes(spellId)
      ? current.filter((id) => id !== spellId)
      : [...current, spellId];

    this.persist(gameId, next);
  }

  /** Rimuove una magia dai pin senza passare per il cap/toggle di canToggle — usato quando la magia
   * viene creata (Grimorio): non ha più senso tenerla come "da ricordarsi di fare", va tolta
   * incondizionatamente. No-op se non era pinnata. */
  unpin(gameId: string, spellId: string): void {
    const current = this.stateFor(gameId)();
    if (!current.includes(spellId)) return;

    this.persist(
      gameId,
      current.filter((id) => id !== spellId),
    );
  }

  private persist(gameId: string, ids: string[]): void {
    this.stateFor(gameId).set(ids);
    localStorage.setItem(STORAGE_PREFIX + gameId, JSON.stringify(ids));
  }

  /** Chiamato a fine partita (status 'finished') — i pin sono un riferimento rapido per QUELLA
   * partita, non ha senso ritrovarseli alla prossima (vedi board.component.ts). */
  clear(gameId: string): void {
    this.stateByGame.delete(gameId);
    localStorage.removeItem(STORAGE_PREFIX + gameId);
  }

  private stateFor(gameId: string): WritableSignal<string[]> {
    let state = this.stateByGame.get(gameId);
    if (!state) {
      state = signal<string[]>(this.readFromStorage(gameId));
      this.stateByGame.set(gameId, state);
    }
    return state;
  }

  private readFromStorage(gameId: string): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + gameId);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : [];
    } catch {
      return [];
    }
  }
}
