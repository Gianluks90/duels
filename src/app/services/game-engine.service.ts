import { Injectable, inject } from '@angular/core';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import type { GameDoc } from './game.service';
import type { BaseElement } from '../models/element.model';
import type { GameState } from '../models/game.model';
import type { PlayerId } from '../models/player.model';
import { createInitialGameState } from '../game/deck-builder';
import {
  advanceTurnPhase,
  combineElements as combineElementsReducer,
  combineSuperior as combineSuperiorReducer,
  keepCard as keepCardReducer,
  startCollect as startCollectReducer,
} from '../game/turn-engine';

/** Motore di turno: ogni azione rilegge lo stato da Firestore, applica un reducer puro (src/app/game/), riscrive il risultato. Nessuna transazione — solo il giocatore di turno scrive stato condiviso durante il proprio turno (vedi documentation/rulebook/v2/rules.md e il piano di implementazione). */
@Injectable({ providedIn: 'root' })
export class GameEngineService {
  private readonly db = inject(FirebaseService).db;

  /**
   * Corregge il bug per cui `setReady()` non fa mai avanzare la partita da 'setup' a 'playing':
   * se entrambi i giocatori sono pronti con bacchetta configurata, crea lo stato iniziale e avvia
   * la partita. No-op idempotente altrimenti — sicuro da chiamare più volte (va chiamato solo dal
   * client host, per evitare che entrambi i client lo eseguano nella stessa corsa).
   */
  async tryStartGame(gameId: string): Promise<void> {
    const ref = doc(this.db, 'games', gameId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return;

    const data = snapshot.data() as GameDoc;
    if (data.status !== 'setup') return;
    if (!data.hostReady || !data.guestReady) return;
    if (!data.hostWand || !data.guestWand) return;

    const state = createInitialGameState(
      { name: data.hostName, wand: data.hostWand },
      { name: data.guestName ?? data.hostName, wand: data.guestWand },
    );

    await updateDoc(ref, { status: 'playing', state });
  }

  /** Fase Raccolta (4.3), primo passo: pesca 2 carte dal mazzo comune (rimescolando se serve) e le mette in sospeso. */
  async startCollect(gameId: string, role: PlayerId): Promise<void> {
    await this.mutate(gameId, state => startCollectReducer(state, role));
  }

  /** Fase Raccolta (4.3), secondo passo: tieni una delle 2 carte in sospeso, l'altra torna negli scarti comuni. */
  async keepCard(gameId: string, role: PlayerId, keptId: string): Promise<void> {
    await this.mutate(gameId, state => keepCardReducer(state, role, keptId));
  }

  /** Fase Azione: combina 2 elementi base dalla mano per ottenere la carta rivelata in uno slot della Fonte Arcana. */
  async combineElements(gameId: string, role: PlayerId, fonteSlotIndex: number, a: BaseElement, b: BaseElement): Promise<void> {
    await this.mutate(gameId, state => combineElementsReducer(state, role, fonteSlotIndex, a, b));
  }

  /** Fase Azione: combina i 4 elementi base (Fuoco+Acqua+Aria+Terra) per ottenere l'elemento potente rivelato in uno slot della Fonte Arcana. */
  async combineSuperior(gameId: string, role: PlayerId, fonteSlotIndex: number): Promise<void> {
    await this.mutate(gameId, state => combineSuperiorReducer(state, role, fonteSlotIndex));
  }

  /** Avanza la fase del giocatore di turno lungo il ciclo delle 6 fasi; da 'fine' passa davvero il turno. */
  async advancePhase(gameId: string, role: PlayerId): Promise<void> {
    await this.mutate(gameId, state => advanceTurnPhase(state, role));
  }

  private async mutate(gameId: string, transform: (state: GameState) => GameState): Promise<void> {
    const ref = doc(this.db, 'games', gameId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return;

    const data = snapshot.data() as GameDoc;
    if (!data.state) return;

    const state = transform(data.state);
    await updateDoc(ref, { state });
  }
}
