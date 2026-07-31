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
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { DEFAULT_BACKGROUND_ID, MAX_FAVORITE_SPELLS, type UserProfile } from '../models/user.model';
import type { RedeemCode } from '../models/redeem-code.model';
import type { GameDoc } from './game.service';
import type { PlayerId } from '../models/player.model';
import { OBJECTIVE_CATALOG } from '../data/objectives';
import { titleRewardVariantIds } from '../data/titles';
import {
  applyGameStatsDelta,
  buildProgressSource,
  newlyCompletedObjectives,
  nextLoginStreak,
  todayLocalDate,
} from '../game/achievements';
import { OBJECTIVES_TRACKING_ENABLED } from '../environment/feature-flags';

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
      Pick<
        UserProfile,
        'displayName' | 'photoURL' | 'cardBack' | 'background' | 'favoriteSpellIds' | 'title'
      >
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

  /** Riscatta codice: sblocca il dorso carta legato a `codes/{codice}` (v. RedeemCode). Il precheck
   * qui sotto (getDoc + date + redeemedCodeIds locale) è solo UX — la regola Firestore su
   * users/{userId} rivalida tutto al momento del write (stesso schema difensivo di
   * GameService.joinGame), quindi resta l'unica fonte di verità reale. Ritorna il cardBackId
   * sbloccato, per mostrarne subito l'anteprima nella dialog di riscatto. */
  async redeemCode(rawCode: string): Promise<string> {
    const user = this.auth.currentUser;
    const current = this.profile();
    if (!user || !current) throw new Error('not-signed-in');

    const code = rawCode.trim().toUpperCase();
    if (!code) throw new Error('code-not-found');
    if ((current.redeemedCodeIds ?? []).includes(code)) throw new Error('already-redeemed');

    const codeSnap = await getDoc(doc(this.firebase.db, 'codes', code));
    if (!codeSnap.exists()) throw new Error('code-not-found');

    const codeData = codeSnap.data() as RedeemCode;
    const now = Date.now();
    if (codeData.startAt && now < codeData.startAt.toMillis()) throw new Error('code-not-started');
    if (codeData.endAt && now > codeData.endAt.toMillis()) throw new Error('code-expired');

    await updateDoc(doc(this.firebase.db, 'users', user.uid), {
      unlockedCardBacks: arrayUnion(codeData.cardBackId),
      redeemedCodeIds: arrayUnion(code),
      lastRedeemedCode: code,
    });

    this.profile.set({
      ...current,
      unlockedCardBacks: [...new Set([...(current.unlockedCardBacks ?? []), codeData.cardBackId])],
      redeemedCodeIds: [...(current.redeemedCodeIds ?? []), code],
      lastRedeemedCode: code,
    });

    return codeData.cardBackId;
  }

  /**
   * Applica al proprio profilo gli stats/obiettivi maturati in UNA partita appena conclusa — da
   * chiamare una volta a fine partita (ResultComponent.ngOnInit). No-op finché
   * OBJECTIVES_TRACKING_ENABLED è `false` (beta): il catalogo resta visibile ovunque, solo il
   * tracciamento è spento. Sicura da richiamare più volte
   * (refresh della pagina, doppio mount del componente...): se `users/{uid}/countedGames/{gameId}`
   * esiste già la partita è stata contata, no-op — questo precheck locale evita solo lo sforzo di un
   * write che la regola Firestore (statsNotYetCounted, v. firestore.rules) respingerebbe comunque,
   * che resta l'unica vera fonte di verità (stesso schema difensivo di redeemCode sopra).
   *
   * Le due scritture (profilo + marker) vanno in un solo writeBatch: non per atomicità reciproca
   * (le regole Firestore le valutano comunque in modo indipendente, v. la nota sul rischio accettato
   * in firestore.rules) ma perché è comunque una sola azione utente, un solo giro di rete.
   */
  async applyGameStats(gameDoc: GameDoc, role: PlayerId): Promise<void> {
    if (!OBJECTIVES_TRACKING_ENABLED) return;
    const user = this.auth.currentUser;
    const current = this.profile();
    if (!user || !current || !gameDoc.state || gameDoc.status !== 'finished') return;

    const countedRef = doc(this.firebase.db, 'users', user.uid, 'countedGames', gameDoc.id);
    if ((await getDoc(countedRef)).exists()) return;

    const nextStats = applyGameStatsDelta(
      current.stats,
      role,
      gameDoc.state.winner,
      gameDoc.state.eventLog,
      gameDoc.wasFriendDuel,
      gameDoc.state.players[role],
    );
    // loginStreak/rulebookRead non cambiano qui (si aggiornano fuori dal flusso di fine partita, v.
    // ensureUserProfile/markRulebookRead sotto) — passare `current` per prima e dopo li tiene
    // semplicemente invariati nel confronto.
    const priorSource = buildProgressSource(current.stats, current);
    const nextSource = buildProgressSource(nextStats, current);
    const completedObjectiveIds = [
      ...new Set([
        ...(current.completedObjectiveIds ?? []),
        ...newlyCompletedObjectives(OBJECTIVE_CATALOG, priorSource, nextSource),
      ]),
    ];

    const batch = writeBatch(this.firebase.db);
    batch.update(doc(this.firebase.db, 'users', user.uid), {
      stats: nextStats,
      lastStatsGameId: gameDoc.id,
      completedObjectiveIds,
    });
    batch.set(countedRef, { countedAt: Date.now() });
    await batch.commit();

    this.profile.set({
      ...current,
      stats: nextStats,
      lastStatsGameId: gameDoc.id,
      completedObjectiveIds,
    });
  }

  /** Riscatta le ricompense di un obiettivo già completato (v. UserProfile.completedObjectiveIds) —
   * un obiettivo può darne più di una insieme (Objective.rewards), ognuna nel proprio campo
   * (unlockedCardBacks/unlockedBackgrounds/unlockedTitles), tutte accreditate in una sola
   * scrittura insieme all'obiettivo aggiunto a claimedObjectiveIds. No-op se l'obiettivo non
   * esiste, non è ancora completato, o è già stato riscattato (evita un write superfluo, la regola
   * Firestore lo accetterebbe comunque come no-op). */
  async claimObjective(objectiveId: string): Promise<void> {
    const user = this.auth.currentUser;
    const current = this.profile();
    if (!user || !current) return;

    const objective = OBJECTIVE_CATALOG.find((o) => o.id === objectiveId);
    if (!objective) return;
    if (!(current.completedObjectiveIds ?? []).includes(objectiveId)) return;
    if ((current.claimedObjectiveIds ?? []).includes(objectiveId)) return;

    const nextClaimed = [...new Set([...(current.claimedObjectiveIds ?? []), objectiveId])];
    const patch: Partial<UserProfile> = { claimedObjectiveIds: nextClaimed };

    for (const reward of objective.rewards) {
      const field =
        reward.type === 'cardBack'
          ? 'unlockedCardBacks'
          : reward.type === 'background'
            ? 'unlockedBackgrounds'
            : reward.type === 'elementVariant'
              ? 'unlockedElementVariants'
              : 'unlockedTitles';
      // I titoli possono sbloccare più di un id in un colpo solo: le varianti di genere (v.
      // data/titles.ts) — dorsi/sfondi/varianti elemento restano sempre un solo id per reward.
      const rewardIds = reward.type === 'title' ? titleRewardVariantIds(reward.id) : [reward.id];
      const prior = patch[field] ?? current[field] ?? [];
      patch[field] = [...new Set([...prior, ...rewardIds])];
    }

    await updateDoc(doc(this.firebase.db, 'users', user.uid), patch);
    this.profile.set({ ...current, ...patch });
  }

  /** Achievements "Istruito"/"Istruita" — segna il regolamento come letto per intero. Chiamata da
   * RulebookDialogComponent ogni volta che finisce di caricare una sezione, no-op oltre la prima
   * volta (già `rulebookRead`) quindi sicura da richiamare ripetutamente. No-op anche finché
   * OBJECTIVES_TRACKING_ENABLED è `false` (beta), stesso schema di applyGameStats sopra. */
  async markRulebookRead(): Promise<void> {
    if (!OBJECTIVES_TRACKING_ENABLED) return;
    const user = this.auth.currentUser;
    const current = this.profile();
    if (!user || !current || current.rulebookRead) return;

    const priorSource = buildProgressSource(current.stats, current);
    const nextSource = buildProgressSource(current.stats, { ...current, rulebookRead: true });
    const completedObjectiveIds = [
      ...new Set([
        ...(current.completedObjectiveIds ?? []),
        ...newlyCompletedObjectives(OBJECTIVE_CATALOG, priorSource, nextSource),
      ]),
    ];

    const patch: Partial<UserProfile> = { rulebookRead: true, completedObjectiveIds };
    await updateDoc(doc(this.firebase.db, 'users', user.uid), patch);
    this.profile.set({ ...current, ...patch });
  }

  /** Achievements "Duellante socievole"/"Duellante amichevole" — sincronizza il numero di amicizie
   * accettate. Chiamata da FriendsDialogComponent ogni volta che carica la lista completa
   * (FriendsService.listFriends) per disegnarla: quel conteggio va comunque recuperato per la UI,
   * quindi il costo aggiuntivo di questa sincronizzazione è pari a zero. No-op se il conteggio non è
   * cambiato dall'ultima sincronizzazione, o finché OBJECTIVES_TRACKING_ENABLED è `false` (beta). */
  async syncFriendsCount(count: number): Promise<void> {
    if (!OBJECTIVES_TRACKING_ENABLED) return;
    const user = this.auth.currentUser;
    const current = this.profile();
    if (!user || !current || (current.friendsCount ?? 0) === count) return;

    const priorSource = buildProgressSource(current.stats, current);
    const nextSource = buildProgressSource(current.stats, { ...current, friendsCount: count });
    const completedObjectiveIds = [
      ...new Set([
        ...(current.completedObjectiveIds ?? []),
        ...newlyCompletedObjectives(OBJECTIVE_CATALOG, priorSource, nextSource),
      ]),
    ];

    const patch: Partial<UserProfile> = { friendsCount: count, completedObjectiveIds };
    await updateDoc(doc(this.firebase.db, 'users', user.uid), patch);
    this.profile.set({ ...current, ...patch });
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
      const data = snapshot.data() as UserProfile;
      const loginPatch = OBJECTIVES_TRACKING_ENABLED ? this.buildLoginStreakPatch(data) : null;
      this.profile.set(loginPatch ? { ...data, ...loginPatch } : data);
      // Fire-and-forget: un bookkeeping non critico non deve ritardare l'avvio dell'app in attesa di
      // un giro di rete in più. Nel peggiore dei casi lo streak non avanza per questa sessione,
      // nessun altro effetto (v. buildLoginStreakPatch).
      if (loginPatch) void updateDoc(ref, loginPatch);
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
      // Unico titolo gratuito per TUTTI fin dall'account (v. TITLE_CATALOG in data/titles.ts) —
      // già equipaggiabile senza claim, `titleValid()` in firestore.rules lo permette a
      // prescindere da `unlockedTitles`, stesso motivo per cui cardBack/background sopra non
      // hanno bisogno di un array "unlocked" per i loro valori di default.
      title: 'beginner',
      // Il primo accesso conta come giorno 1 dello streak — solo se il tracciamento è attivo (beta,
      // v. OBJECTIVES_TRACKING_ENABLED), altrimenti restano assenti finché non lo si riattiva.
      ...(OBJECTIVES_TRACKING_ENABLED ? { lastLoginDate: todayLocalDate(), loginStreak: 1 } : {}),
    };

    await setDoc(ref, newProfile);
    this.profile.set(newProfile);
  }

  /** Achievements "Login 7 giorni consecutivi" — null se oggi è già stato registrato (nessuna
   * scrittura necessaria). Stesso schema di applyGameStats/markRulebookRead per il calcolo di
   * completedObjectiveIds, ma senza alcuna partita coinvolta: nextLoginStreak (game/achievements.ts)
   * è pura data-math sull'ultimo giorno registrato. */
  private buildLoginStreakPatch(profile: UserProfile): Partial<UserProfile> | null {
    const next = nextLoginStreak(profile.lastLoginDate, profile.loginStreak);
    if (!next) return null;

    const loginFields: Partial<UserProfile> = {
      lastLoginDate: next.date,
      loginStreak: next.streak,
    };
    const priorSource = buildProgressSource(profile.stats, profile);
    const nextSource = buildProgressSource(profile.stats, { ...profile, ...loginFields });
    const completedObjectiveIds = [
      ...new Set([
        ...(profile.completedObjectiveIds ?? []),
        ...newlyCompletedObjectives(OBJECTIVE_CATALOG, priorSource, nextSource),
      ]),
    ];

    return { ...loginFields, completedObjectiveIds };
  }
}
