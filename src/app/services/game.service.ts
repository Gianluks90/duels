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
  getDocs,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { type User } from 'firebase/auth';
import { FirebaseService } from './firebase.service';
import type { Wand } from '../models/wand.model';
import type { GameState } from '../models/game.model';
import { createInitialGameState } from '../game/deck-builder';
import { resolveElementalExplosions } from '../game/turn-engine';

export interface GameDoc {
  id: string;
  status: 'waiting' | 'setup' | 'playing' | 'finished';
  hostId: string;
  hostName: string;
  hostPhoto: string | null;
  hostWand: Wand | null;
  hostReady: boolean;
  guestId: string | null;
  guestName: string | null;
  guestPhoto: string | null;
  guestWand: Wand | null;
  guestReady: boolean;
  createdAt: number;
  state: GameState | null;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly db = inject(FirebaseService).db;

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async createGame(user: User): Promise<string> {
    const gameId = this.generateRoomCode();
    const data: GameDoc = {
      id: gameId,
      status: 'waiting',
      hostId: user.uid,
      hostName: user.displayName ?? 'Mago',
      hostPhoto: user.photoURL,
      hostWand: null,
      hostReady: false,
      guestId: null,
      guestName: null,
      guestPhoto: null,
      guestWand: null,
      guestReady: false,
      createdAt: Date.now(),
      state: null,
    };
    await setDoc(doc(this.db, 'games', gameId), data);
    return gameId;
  }

  async joinGame(gameId: string, user: User): Promise<void> {
    const ref = doc(this.db, 'games', gameId);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) throw new Error('game-not-found');

    const data = snapshot.data() as GameDoc;
    if (data.status !== 'waiting') throw new Error('game-full-or-started');
    if (data.hostId === user.uid) throw new Error('already-host');

    await updateDoc(ref, {
      guestId: user.uid,
      guestName: user.displayName ?? 'Mago',
      guestPhoto: user.photoURL,
      status: 'setup',
    });
  }

  async setReady(gameId: string, role: 'host' | 'guest', wand: Wand): Promise<void> {
    const ref = doc(this.db, 'games', gameId);
    await updateDoc(ref, {
      [`${role}Wand`]: wand,
      [`${role}Ready`]: true,
    });
  }

  async createDebugGame(user: User): Promise<string> {
    const gameId = this.generateRoomCode();
    const defaultWand: Wand = { handleSocket: null, bodySocket: null, tipSlot: null };
    const hostName = user.displayName ?? 'Mago';
    const guestName = 'Avversario Debug';
    const data: GameDoc = {
      id: gameId,
      status: 'playing',
      hostId: user.uid,
      hostName,
      hostPhoto: user.photoURL,
      hostWand: defaultWand,
      hostReady: true,
      guestId: 'debug-guest',
      guestName,
      guestPhoto: null,
      guestWand: defaultWand,
      guestReady: true,
      createdAt: Date.now(),
      // Esplosione elementale (2.4): come in tryStartGame, la mano iniziale o la Fonte Arcana
      // appena rivelata potrebbero già contenere sia Luce che Tenebra fin dal primo istante.
      state: resolveElementalExplosions(createInitialGameState(
        { name: hostName, wand: defaultWand },
        { name: guestName, wand: defaultWand },
      )),
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

  listenToGame(gameId: string, callback: (game: GameDoc | null) => void): Unsubscribe {
    return onSnapshot(doc(this.db, 'games', gameId), snapshot => {
      callback(snapshot.exists() ? (snapshot.data() as GameDoc) : null);
    });
  }
}
