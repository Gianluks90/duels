import type { Timestamp } from 'firebase/firestore';

/** codes/{CODICE} — CODICE è l'id documento (normalizzato uppercase da AuthService.redeemCode),
 * scritto solo manualmente (console/CLI Firebase), mai dal client (v. firestore.rules,
 * `allow write: if false`). */
export interface RedeemCode {
  cardBackId: string;
  startAt: Timestamp | null;
  endAt: Timestamp | null;
}
