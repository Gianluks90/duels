/** Id letterali di CARD_PATTERN_CATALOG (data/card-patterns.ts) — unione esplicita invece di
 * derivata dai dati (a differenza di CollectibleElement/COLLECTIBLE_ELEMENT_IDS in
 * element.model.ts/data/elements.ts): serve staticamente per generare le chiavi
 * `pattern_${CardPatternId}` di ObjectiveMetric, va quindi estesa qui ogni volta che si aggiunge un
 * pattern nuovo al catalogo. */
export type CardPatternId = 'reveal_trio' | 'all_elements' | 'lucky_win';

export type CardPatternMode =
  /** Tutti gli identificativi richiesti presenti — il resto del mazzo è irrilevante. */
  | 'contains'
  /** Tutti gli identificativi richiesti presenti, nessun'altra carta dello stesso genere (v.
   * cardKind sotto) presente. */
  | 'exclusiveAll'
  /** Solo carte con identificativo nell'insieme richiesto (anche solo alcuni, non serve il set
   * completo) — nessun'altra carta dello stesso genere presente. */
  | 'exclusiveAny'
  /** Nessuno degli identificativi richiesti presente. */
  | 'excludes';

/**
 * Pattern di composizione mazzo (Achievements, v. game/achievements.ts computeCardPatternMatches)
 * — valutato sulle carte accumulate dal giocatore a fine partita (mazzo residuo + mano + scarti +
 * carte "in transito", non solo l'eventLog): il modo per esprimere obiettivi come "Che tutto vede"
 * (3 incantesimi specifici posseduti insieme) o "solo carte Fuoco e Lava nel mazzo" senza dover
 * loggare l'istante esatto in cui succede.
 */
export interface CardPattern {
  id: CardPatternId;
  /** 'spell' confronta solo le carte con `tier === 'spell'` (per Card.spellId), 'element' solo le
   * altre (per Card.element) — nelle modalità esclusive le carte dell'altro genere non contano né a
   * favore né contro: le magie create durante la partita non "rompono" un pattern sugli elementi. */
  cardKind: 'spell' | 'element';
  /** SpellId (cardKind 'spell') o Element (cardKind 'element') richiesti dal pattern. */
  identifiers: readonly string[];
  mode: CardPatternMode;
  /** Solo per `mode: 'exclusiveAll'`: identificativi TOLLERATI oltre a `identifiers` (non serve che
   * ci siano, ma se ci sono non rompono l'esclusività) — es. "Fortunato" (Reset+Rischio sempre
   * entrambi presenti, `identifiers`) con qualunque sottoinsieme di magie base tollerato in più
   * (`allowedExtra`) senza dover elencare ogni combinazione come pattern a parte. Ignorato dalle
   * altre modalità. */
  allowedExtra?: readonly string[];
  /** true = il pattern combacia solo se il giocatore ha VINTO la partita (v.
   * game/achievements.ts computeCardPatternMatches) — assente/false = indipendente dall'esito,
   * come 'reveal_trio'/'all_elements'. */
  requireWin?: boolean;
}
