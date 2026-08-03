import type { CardPattern } from '../models/card-pattern.model';

/**
 * Catalogo pattern di composizione mazzo (Achievements) — valutati sullo stato FINALE della
 * partita (v. computeCardPatternMatches in game/achievements.ts), non sull'eventLog: evita il cap
 * a 50 voci che avrebbe reso "Che tutto vede" (le 3 magie di rivelazione possedute insieme) non
 * tracciabile come evento puntuale, controllando invece se le carte sono ancora nel mazzo del
 * giocatore (mazzo residuo + mano + scarti + carte in transito) a fine partita — una carta
 * incantesimo, una volta creata, non sparisce mai finché la partita non finisce.
 */
export const CARD_PATTERN_CATALOG: CardPattern[] = [
  {
    id: 'reveal_trio',
    cardKind: 'spell',
    identifiers: ['third_eye', 'supreme_eye', 'spell_glimpse'],
    mode: 'contains',
  },
  // "Preparato a tutto"/"Preparata a tutto": un elemento base + un avanzato per tipo, più luce e
  // tenebra — Residuo Arcano/mana ESCLUSI apposta (non menzionati nel design originale, v.
  // documentation/titles.md), ma non "rompono" comunque il pattern in mode 'contains'.
  {
    id: 'all_elements',
    cardKind: 'element',
    identifiers: [
      'fire',
      'water',
      'air',
      'earth',
      'thunder',
      'poison',
      'ice',
      'lava',
      'light',
      'dark',
    ],
    mode: 'contains',
  },
  // "Fortunato"/"Fortunata"/"Fortunat*": Reset E Rischio SEMPRE entrambi presenti (identifiers),
  // qualunque sottoinsieme delle magie base tollerato in più (allowedExtra) — starter_bolt/
  // starter_balm incluse: sono seminate in ogni mazzo fin dall'inizio e non si possono mai
  // rimuovere, escluderle renderebbe l'obiettivo impossibile per chiunque. Nessun'altra magia
  // craftata ammessa. requireWin: l'obiettivo vale solo per il duello VINTO in queste condizioni,
  // non semplicemente giocato.
  {
    id: 'lucky_win',
    cardKind: 'spell',
    identifiers: ['reset', 'risk'],
    allowedExtra: [
      'fire_bolt',
      'water_lance',
      'air_slash',
      'earth_shard',
      'starter_bolt',
      'starter_balm',
    ],
    mode: 'exclusiveAll',
    requireWin: true,
  },
  // "Diabolico"/"Diabolica": vittoria in una partita in cui la Fiamma Nera è stata lanciata —
  // 'contains' invece dell'eventLog (rischio-cap a 50 voci, v. README) perché una carta incantesimo
  // lanciata finisce negli SCARTI DEL GIOCATORE (PlayerState.discards, v. resolveSpells in
  // turn-engine.ts), non in quelli comuni: resta quindi rintracciabile nello stato finale come ogni
  // altro pattern qui sopra, anche dopo essere stata risolta (a differenza di una carta incastonata
  // nell'asta/manico, che va invece negli scarti comuni).
  {
    id: 'black_flame_win',
    cardKind: 'spell',
    identifiers: ['black_flame'],
    mode: 'contains',
    requireWin: true,
  },
];
