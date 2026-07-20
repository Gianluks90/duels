import { Injectable, computed, signal } from '@angular/core';
import type { GameDoc } from './game.service';
import type { GameState } from '../models/game.model';

/**
 * Detiene lo stato grezzo della partita corrente (il documento Firestore così com'è, sempre
 * aggiornato subito) — BoardComponent scrive qui non appena `GameService.listenToGame` consegna un
 * nuovo snapshot, il resto dell'app (computed derivati, logica di auto-avanzamento fase, validazioni)
 * legge sempre da qui, mai da un valore ritardato: solo AnimationQueueService, a valle, decide cosa
 * animare a partire da questi stessi aggiornamenti.
 *
 * Fornito a livello di BoardComponent (non root, vedi providers nel @Component) — un'istanza per
 * sessione di partita, niente stato residuo tra una partita e la successiva.
 */
@Injectable()
export class GameStateService {
  readonly gameDoc = signal<GameDoc | null>(null);
  readonly rawState = computed<GameState | null>(() => this.gameDoc()?.state ?? null);
}
