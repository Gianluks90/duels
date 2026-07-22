import type { CardBackSkin } from './player.model';

/** Id di default per UserProfile.background — qui (non in background.service.ts) perché sia
 * AuthService (profilo nuovo) sia BackgroundService (fallback prima che il profilo carichi) ne
 * hanno bisogno senza dipendere l'uno dall'altro. Deve combaciare con un id presente in
 * public/config/backgrounds.json. */
export const DEFAULT_BACKGROUND_ID = 'dark-wood';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  cardBack: CardBackSkin;
  /** Id dello sfondo dell'app (public/config/backgrounds.json), applicato globalmente da
   * BackgroundService. */
  background: string;
  createdAt: number;
  /** Id di Spell.id (SPELL_CATALOG) segnati come preferiti — max 5 (vedi AuthService.toggleFavoriteSpell).
   * Assente sui profili creati prima di questa feature: va letto con `?? []`. */
  favoriteSpellIds?: string[];
}

/** Numero massimo di incantesimi che un utente può segnare come preferiti (globale, account-level). */
export const MAX_FAVORITE_SPELLS = 5;
