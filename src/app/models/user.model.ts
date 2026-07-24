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
  /** Dorsi bonus posseduti (oltre ai gratuiti in public/config/card-backs.json) — sbloccati via
   * "riscatta codice" (AuthService.redeemCode). Assente sui profili senza sblocchi: `?? []`. */
  unlockedCardBacks?: string[];
  /** Codici già riscattati da questo utente — usato sia per il messaggio "già riscattato" in UI sia
   * come sorgente di verità per AuthService.redeemCode(); v. anche redeemValid() in firestore.rules. */
  redeemedCodeIds?: string[];
  /** Ultimo codice riscattato — persistito per un solo motivo: dare alla regola Firestore su
   * users/{userId} un riferimento diretto a QUALE codes/{CODICE} verificare quando cardBack/
   * unlockedCardBacks cambiano insieme a redeemedCodeIds (le regole non possono altrimenti risalire
   * a quale codice ha generato lo sblocco). Nessun altro scopo applicativo. */
  lastRedeemedCode?: string;
}

/** Numero massimo di incantesimi che un utente può segnare come preferiti (globale, account-level). */
export const MAX_FAVORITE_SPELLS = 5;
