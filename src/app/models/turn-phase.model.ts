export type TurnPhase = 'attesa' | 'preparazione' | 'raccolta' | 'azione' | 'incantesimo' | 'fine';

export const TURN_PHASES: readonly TurnPhase[] = [
  'attesa',
  'preparazione',
  'raccolta',
  'azione',
  'incantesimo',
  'fine',
];

/** Le fasi che possono essere davvero persistite in GameState.phase — 'attesa' non lo è mai: è solo il valore mostrato a chi non è di turno (regolamento v2, 4.1). */
export type ActiveTurnPhase = Exclude<TurnPhase, 'attesa'>;
