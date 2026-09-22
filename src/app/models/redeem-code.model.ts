import type { Timestamp } from 'firebase/firestore';

/** codes/{CODICE} — CODICE è l'id documento (normalizzato uppercase da AuthService.redeemCode),
 * scritto solo manualmente (console/CLI Firebase), mai dal client (v. firestore.rules,
 * `allow write: if false`). Un codice può accreditare più tipi di ricompensa insieme (es. un dorso
 * E una frase emote) — due array separati invece di un unico `rewards: {type,id}[]` (come
 * Objective.rewards) perché le regole Firestore non supportano filtri/lambda su array di oggetti:
 * con due campi tipizzati, `redeemGrantValid()` in firestore.rules può validare ciascuno con un
 * semplice `hasAll()`/`size()`, senza dover isolare "solo gli id di tipo cardBack" da una lista
 * mista. Entrambi opzionali/assenti se il codice non ne assegna di quel tipo. */
export interface RedeemCode {
  cardBackIds?: string[];
  emoteIds?: string[];
  startAt: Timestamp | null;
  endAt: Timestamp | null;
}

export type RedeemCodeRewardType = 'cardBack' | 'emote';

/** Una ricompensa accreditata da un riscatto — ciò che AuthService.redeemCode() ritorna, per far
 * sapere a RedeemDialogComponent cosa mostrare in anteprima (non necessariamente un solo dorso
 * come prima di questa estensione). */
export interface RedeemCodeReward {
  type: RedeemCodeRewardType;
  /** Id del dorso (CARD_BACK_CATALOG) o dell'emote (EMOTE_CATALOG) sbloccato. */
  id: string;
}
