export type TurnPhase = 'attesa' | 'preparazione' | 'raccolta' | 'azione' | 'incantesimo' | 'fine';

export const TURN_PHASES: readonly TurnPhase[] = [
  'attesa',
  'preparazione',
  'raccolta',
  'azione',
  'incantesimo',
  'fine',
];

const TURN_PHASE_LABELS: Record<TurnPhase, string> = {
  attesa: 'Attesa',
  preparazione: 'Preparazione',
  raccolta: 'Raccolta',
  azione: 'Azione',
  incantesimo: 'Incantesimo',
  fine: 'Fine',
};

export function turnPhaseLabel(phase: TurnPhase): string {
  return TURN_PHASE_LABELS[phase];
}

const TURN_PHASE_DESCRIPTIONS: Record<TurnPhase, string> = {
  attesa: "Attendi che l'avversario concluda il suo turno",
  preparazione: 'Vengono risolti alcuni effetti di inizio turno',
  raccolta: 'Raccogli le risorse',
  azione: 'Effettua delle azioni',
  incantesimo: 'Vengono lanciati gli incantesimi selezionati',
  fine: 'Vengono risolti alcuni effetti di fine turno prima di concluderlo',
};

export function turnPhaseDescription(phase: TurnPhase): string {
  return TURN_PHASE_DESCRIPTIONS[phase];
}
