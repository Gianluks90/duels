import { Injectable, inject } from '@angular/core';
import { doc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import type { GameDoc } from './game.service';
import type { BaseElement } from '../models/element.model';
import type { GameState } from '../models/game.model';
import type { PlayerId } from '../models/player.model';
import { createInitialGameState } from '../game/deck-builder';
import {
  advanceTurnPhase,
  castSpell as castSpellReducer,
  combineElements as combineElementsReducer,
  combineSuperior as combineSuperiorReducer,
  combineResidue as combineResidueReducer,
  holdAtTip as holdAtTipReducer,
  keepCard as keepCardReducer,
  resolveElementalExplosions,
  startCollect as startCollectReducer,
} from '../game/turn-engine';

/**
 * Motore di turno: ogni azione rilegge lo stato da Firestore, applica un reducer puro
 * (src/app/game/), riscrive il risultato — dentro una transazione (`mutate`), non un
 * getDoc+updateDoc separati: due scritture concorrenti (es. il proprio auto-avanzamento e quello
 * dell'avversario di debug, quasi simultanei) altrimenti potevano correre in read-modify-write,
 * con quella basata sullo snapshot più vecchio che sovrascriveva l'altra "resuscitando" stato già
 * superato (bug reale osservato: un Residuo Arcano consumato a fine turno tornava disponibile).
 */
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

    // Esplosione elementale (2.4): la mano iniziale (pescata dal proprio mazzo, con 1 Luce + 1
    // Tenebra ciascuno, 1.2) o la Fonte Arcana appena rivelata potrebbero già contenere entrambi
    // gli elementi potenti fin dal primo istante.
    const state = resolveElementalExplosions(createInitialGameState(
      { name: data.hostName, wand: data.hostWand },
      { name: data.guestName ?? data.hostName, wand: data.guestWand },
    ));

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

  /** Fase Azione: combina 2 elementi base dalla mano per ottenere la carta rivelata in uno slot della Fonte Arcana. `chosenIds` forza quale copia usare per un elemento quando in mano ce n'era più di una valida (CombineDialogComponent, board.component.ts) — assente quando non c'era ambiguità, si procede con la scelta automatica di sempre. */
  async combineElements(gameId: string, role: PlayerId, fonteSlotIndex: number, a: BaseElement, b: BaseElement, chosenIds?: Partial<Record<BaseElement, string>>): Promise<void> {
    await this.mutate(gameId, state => combineElementsReducer(state, role, fonteSlotIndex, a, b, chosenIds));
  }

  /** Fase Azione: combina i 4 elementi base (Fuoco+Acqua+Aria+Terra) per ottenere l'elemento potente rivelato in uno slot della Fonte Arcana. `chosenIds`: vedi combineElements. */
  async combineSuperior(gameId: string, role: PlayerId, fonteSlotIndex: number, chosenIds?: Partial<Record<BaseElement, string>>): Promise<void> {
    await this.mutate(gameId, state => combineSuperiorReducer(state, role, fonteSlotIndex, chosenIds));
  }

  /** Fase Azione: combina 2 elementi base opposti per ottenere un Residuo Arcano dal pool condiviso. `chosenIds`: vedi combineElements. */
  async combineResidue(gameId: string, role: PlayerId, a: BaseElement, b: BaseElement, chosenIds?: Partial<Record<BaseElement, string>>): Promise<void> {
    await this.mutate(gameId, state => combineResidueReducer(state, role, a, b, chosenIds));
  }

  /** Avanza la fase del giocatore di turno lungo il ciclo delle 6 fasi; da 'fine' passa davvero il turno. */
  async advancePhase(gameId: string, role: PlayerId): Promise<void> {
    await this.mutate(gameId, state => advanceTurnPhase(state, role));
  }

  /** Fase Azione (5.2): lancia una carta incantesimo dalla mano, pagando il costo con le carte indicate. L'effetto si risolve più avanti, al passaggio in fase Incantesimo (dentro advancePhase). */
  async castSpell(gameId: string, role: PlayerId, spellCardId: string, paidCardIds: readonly string[]): Promise<void> {
    await this.mutate(gameId, state => castSpellReducer(state, role, spellCardId, paidCardIds));
  }

  /** Fase Azione (1.4.1/4.4): trattiene una carta base dalla mano nella punta della bacchetta. */
  async holdAtTip(gameId: string, role: PlayerId, cardId: string): Promise<void> {
    await this.mutate(gameId, state => holdAtTipReducer(state, role, cardId));
  }

  private async mutate(gameId: string, transform: (state: GameState) => GameState): Promise<void> {
    const ref = doc(this.db, 'games', gameId);
    await runTransaction(this.db, async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists()) return;

      const data = snapshot.data() as GameDoc;
      if (!data.state) return;

      const state = transform(data.state);
      tx.update(ref, { state });
    });
  }
}
