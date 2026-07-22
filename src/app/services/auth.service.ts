import { Injectable, inject, signal, computed } from '@angular/core';
import {
  getAuth,
  signInWithPopup,
  signOut,
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { DEFAULT_BACKGROUND_ID, MAX_FAVORITE_SPELLS, type UserProfile } from '../models/user.model';

export const DEBUG_UID = '8AkU1Du8BlNQYDKzH8Icu7lf8Qt2';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebase = inject(FirebaseService);
  private readonly auth = getAuth();

  readonly user = signal<User | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(true);
  readonly isDebugUser = computed(() => this.user()?.uid === DEBUG_UID);

  readonly ready: Promise<void>;

  constructor() {
    let resolve!: () => void;
    this.ready = new Promise((r) => (resolve = r));

    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user);
      if (user) {
        await this.ensureUserProfile(user);
      } else {
        this.profile.set(null);
      }
      this.loading.set(false);
      resolve();
    });
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  async updateProfile(
    patch: Partial<
      Pick<UserProfile, 'displayName' | 'photoURL' | 'cardBack' | 'background' | 'favoriteSpellIds'>
    >,
  ): Promise<void> {
    const user = this.auth.currentUser;
    const current = this.profile();
    if (!user || !current) return;

    await updateDoc(doc(this.firebase.db, 'users', user.uid), patch);
    this.profile.set({ ...current, ...patch });
  }

  /** Regolamento "Qualità della vita" — segna/rimuove una magia dai preferiti dell'account (visibili
   * all'avversario in partita, vedi GameDoc.hostFavoriteSpellIds/guestFavoriteSpellIds). Cap a
   * MAX_FAVORITE_SPELLS applicato qui (unico punto di scrittura) invece che nel chiamante, così ogni UI
   * che lo invoca (oggi solo il Grimorio) eredita lo stesso limite senza doverlo ridichiarare. No-op se
   * si prova ad aggiungerne una oltre il limite. */
  async toggleFavoriteSpell(spellId: string): Promise<void> {
    const current = this.profile();
    if (!current) return;

    const favorites = current.favoriteSpellIds ?? [];
    const isFavorite = favorites.includes(spellId);
    if (!isFavorite && favorites.length >= MAX_FAVORITE_SPELLS) return;

    const next = isFavorite ? favorites.filter((id) => id !== spellId) : [...favorites, spellId];
    await this.updateProfile({ favoriteSpellIds: next });
  }

  async deleteAccount(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    await deleteDoc(doc(this.firebase.db, 'users', user.uid));
    await deleteUser(user);
  }

  private async ensureUserProfile(user: User): Promise<void> {
    const ref = doc(this.firebase.db, 'users', user.uid);
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      this.profile.set(snapshot.data() as UserProfile);
      return;
    }

    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName ?? 'Mago Senza Nome',
      email: user.email ?? '',
      photoURL: user.photoURL,
      cardBack: 'dark',
      background: DEFAULT_BACKGROUND_ID,
      createdAt: Date.now(),
      favoriteSpellIds: [],
    };

    await setDoc(ref, newProfile);
    this.profile.set(newProfile);
  }
}
