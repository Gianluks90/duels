import { Injectable, inject } from '@angular/core';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  collection,
  where,
  orderBy,
  getDocs,
  limit,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import type { Wand } from '../models/wand.model';
import type { GameState } from '../models/game.model';
import type { UserProfile } from '../models/user.model';
import { createInitialGameState } from '../game/deck-builder';
import { resolveElementalExplosions } from '../game/turn-engine';

export interface GameDoc {
  id: string;
  status: 'waiting' | 'setup' | 'playing' | 'finished';
  hostId: string;
  hostName: string;
  hostPhoto: string | null;
  /** Snapshot di UserProfile.favoriteSpellIds preso al momento della creazione partita (stesso schema
   * di hostName/hostPhoto) — se l'host cambia i preferiti a metà partita, l'avversario continua a
   * vedere lo snapshot preso al join, non l'aggiornamento live. */
  hostFavoriteSpellIds: string[];
  hostWand: Wand | null;
  hostReady: boolean;
  guestId: string | null;
  guestName: string | null;
  guestPhoto: string | null;
  /** Vedi hostFavoriteSpellIds — stesso snapshot-al-join, lato guest. */
  guestFavoriteSpellIds: string[];
  guestWand: Wand | null;
  guestReady: boolean;
  createdAt: number;
  state: GameState | null;
  /** Protezione opzionale per la lobby pubblica (Qualità della vita) — "per disattenzione", non un
   * vero segreto: un documento 'waiting' è già leggibile da chiunque autenticato (vedi la regola su
   * games/{gameId}), quindi anche questo campo lo è. Basta a scoraggiare un ingresso casuale, non
   * regge a chi legge il documento direttamente invece che dalla UI — compromesso accettato
   * consapevolmente, la verifica server-side richiederebbe Cloud Functions. */
  password: string | null;
  /** Visibilità in lobby pubblica (Qualità della vita) — preferenza rispettata lato client
   * (listOpenGames() legge comunque tutte le 'waiting', home.component.ts nasconde quelle 'friends'
   * a chi non è amico dell'host), non un vero controllo server-side: le regole Firestore non possono
   * filtrare i risultati di una query (o tutta la query è permessa, o è negata), quindi con la query
   * unica esistente non è possibile negare la lettura solo per alcuni documenti. Stesso compromesso
   * già accettato per `password` — indipendente da essa: una partita può avere l'una, l'altra,
   * entrambe o nessuna delle due. */
  visibility: 'public' | 'friends';
}

export interface CreateGameOptions {
  password?: string;
  friendsOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly db = inject(FirebaseService).db;

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
      '',
    );
  }

  async createGame(profile: UserProfile, options?: CreateGameOptions): Promise<string> {
    const gameId = this.generateRoomCode();
    const data: GameDoc = {
      id: gameId,
      status: 'waiting',
      hostId: profile.uid,
      hostName: profile.displayName,
      hostPhoto: profile.photoURL,
      hostFavoriteSpellIds: profile.favoriteSpellIds ?? [],
      hostWand: null,
      hostReady: false,
      guestId: null,
      guestName: null,
      guestPhoto: null,
      guestFavoriteSpellIds: [],
      guestWand: null,
      guestReady: false,
      createdAt: Date.now(),
      state: null,
      password: options?.password?.trim() || null,
      visibility: options?.friendsOnly ? 'friends' : 'public',
    };
    await setDoc(doc(this.db, 'games', gameId), data);
    return gameId;
  }

  /** Transazionale (non un getDoc+updateDoc separati) — con la lobby pubblica più persone possono
   * cliccare "entra" sulla stessa partita quasi in contemporanea: senza atomicità il secondo write
   * silenziosamente sovrascriverebbe il primo (stesso bug già risolto altrove nel progetto per lo
   * stesso motivo, vedi GameEngineService.mutate). Con la transazione, chi arriva secondo riceve
   * pulito 'game-full-or-started' invece di soppiantare il primo guest. */
  async joinGame(gameId: string, profile: UserProfile, password?: string): Promise<void> {
    const ref = doc(this.db, 'games', gameId);

    await runTransaction(this.db, async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists()) throw new Error('game-not-found');

      const data = snapshot.data() as GameDoc;
      if (data.status !== 'waiting') throw new Error('game-full-or-started');
      if (data.hostId === profile.uid) throw new Error('already-host');
      if (data.password && data.password !== password) throw new Error('wrong-password');

      tx.update(ref, {
        guestId: profile.uid,
        guestName: profile.displayName,
        guestPhoto: profile.photoURL,
        guestFavoriteSpellIds: profile.favoriteSpellIds ?? [],
        status: 'setup',
      });
    });
  }

  async setReady(gameId: string, role: 'host' | 'guest', wand: Wand): Promise<void> {
    const ref = doc(this.db, 'games', gameId);
    await updateDoc(ref, {
      [`${role}Wand`]: wand,
      [`${role}Ready`]: true,
    });
  }

  async createDebugGame(profile: UserProfile): Promise<string> {
    const gameId = this.generateRoomCode();
    const defaultWand: Wand = { handleSocket: null, bodySocket: null, tipSlot: null };
    const hostName = profile.displayName;
    const guestName = 'Avversario Debug';
    const data: GameDoc = {
      id: gameId,
      status: 'playing',
      hostId: profile.uid,
      hostName,
      hostPhoto: profile.photoURL,
      hostFavoriteSpellIds: profile.favoriteSpellIds ?? [],
      hostWand: defaultWand,
      hostReady: true,
      guestId: 'debug-guest',
      guestName,
      guestPhoto: null,
      guestFavoriteSpellIds: [],
      guestWand: defaultWand,
      guestReady: true,
      createdAt: Date.now(),
      password: null,
      visibility: 'public',
      // Esplosione elementale (2.4): come in tryStartGame, la mano iniziale o la Fonte Arcana
      // appena rivelata potrebbero già contenere sia Luce che Tenebra fin dal primo istante.
      state: resolveElementalExplosions(
        createInitialGameState(
          { name: hostName, wand: defaultWand },
          { name: guestName, wand: defaultWand },
        ),
      ),
    };
    await setDoc(doc(this.db, 'games', gameId), data);
    return gameId;
  }

  async cancelGame(gameId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'games', gameId));
  }

  async surrender(gameId: string): Promise<void> {
    await updateDoc(doc(this.db, 'games', gameId), { status: 'finished' });
  }

  async findMyWaitingGame(uid: string): Promise<string | null> {
    const q = query(
      collection(this.db, 'games'),
      where('hostId', '==', uid),
      where('status', '==', 'waiting'),
      limit(1),
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0].id;
  }

  /** Lobby pubblica (Qualità della vita): ogni partita 'waiting' è già leggibile da chiunque
   * autenticato (vedi la regola su games/{gameId}, pensata originariamente solo per joinGame() sul
   * singolo ID) — questa query sfrutta la stessa regola senza bisogno di modificarla. Nessun filtro
   * hostId (a differenza di findMyWaitingGame sopra): qui servono le partite di TUTTI. */
  async listOpenGames(): Promise<GameDoc[]> {
    const q = query(
      collection(this.db, 'games'),
      where('status', '==', 'waiting'),
      orderBy('createdAt', 'desc'),
      limit(30),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as GameDoc);
  }

  /** `onError`: le regole Firestore negano la lettura a chi non è host/guest della partita — senza un handler l'errore resterebbe silenzioso e `callback` non verrebbe più richiamato. */
  listenToGame(
    gameId: string,
    callback: (game: GameDoc | null) => void,
    onError?: () => void,
  ): Unsubscribe {
    return onSnapshot(
      doc(this.db, 'games', gameId),
      (snapshot) => {
        callback(snapshot.exists() ? (snapshot.data() as GameDoc) : null);
      },
      () => onError?.(),
    );
  }
}
