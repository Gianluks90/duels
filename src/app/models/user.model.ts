import type { CardBackSkin } from './player.model';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  cardBack: CardBackSkin;
  createdAt: number;
}
