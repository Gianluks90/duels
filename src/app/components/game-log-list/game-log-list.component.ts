import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import type { GameLogEntry } from '../../models/game-log.model';
import type { PlayerId } from '../../models/player.model';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { SPELL_CATALOG } from '../../data/spells';

/**
 * Lista di eventi di gioco (danno/cura/scudo, veleno/congelamento risolti, incantesimi,
 * combinazioni, bacchetta...) — estratta da GameLogDialogComponent perché lo stesso "log" serve
 * anche fuori dalla partita (colonna "Eventi partita" a fine duello, result.component.ts): un solo
 * posto che sa trasformare GameLogEntry in una frase, invece di duplicare lo switch describe() in
 * due componenti. Più recenti in cima, come un feed. Nessuna icona per riga di proposito (v1
 * volutamente essenziale) — solo testo, una frase per voce.
 */
@Component({
  selector: 'app-game-log-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './game-log-list.component.html',
  styleUrl: './game-log-list.component.scss',
})
export class GameLogListComponent {
  protected readonly i18n = inject(TranslationService);

  readonly entries = input.required<readonly GameLogEntry[]>();
  /** Il proprio ruolo — decide "tu"/nome dell'avversario per ogni voce (GameLogEntry.role non porta
   * alcuna prospettiva, solo chi ha agito/subito: la stessa lista, letta da entrambi i client, produce
   * due frasi diverse a seconda di chi la guarda). */
  readonly myRole = input.required<PlayerId>();
  readonly opponentName = input.required<string>();

  /** Più recenti in cima — si legge come un feed, non come una cronaca dall'inizio. `cardCollected`
   * esclusa di proposito: alimenta solo UserStats.cardsCollected (AchievementsService), è troppo
   * frequente (una volta a turno) per essere un evento "notevole" da mostrare qui. */
  protected readonly visibleEntries = computed(() =>
    [...this.entries()].reverse().filter((entry) => entry.type !== 'cardCollected'),
  );

  /** Etichetta oraria opaca accanto a ogni voce (es. "14:32"), locale del browser — non un dato di
   * dominio, solo un ausilio visivo per orientarsi nella cronologia. */
  protected formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private spellName(spellId: string): string {
    const spell = SPELL_CATALOG.find((s) => s.id === spellId);
    return spell ? this.i18n.t(`spells.${spell.id}.name`) : spellId;
  }

  /** `gameLog.entries.{baseKey}Self`/`{baseKey}Other` a seconda di chi ha agito/subito. */
  private pick(baseKey: string, self: boolean, params: Record<string, string | number>): string {
    return this.i18n.t(`gameLog.entries.${baseKey}${self ? 'Self' : 'Other'}`, params);
  }

  protected describe(entry: GameLogEntry): string {
    const self = entry.role === this.myRole();
    const name = this.opponentName();

    switch (entry.type) {
      case 'damage': {
        const amount = entry.amount;
        if (entry.source.kind === 'spell') {
          return this.pick('damageSpell', self, {
            amount,
            spell: this.spellName(entry.source.spellId),
            name,
          });
        }
        return this.pick('damagePoison', self, { amount, name });
      }
      case 'healed':
        return this.pick('healed', self, {
          amount: entry.amount,
          spell: this.spellName(entry.spellId),
          name,
        });
      case 'shieldGained':
        return this.pick('shieldGained', self, { amount: entry.amount, name });
      case 'shieldRemoved':
        return this.pick('shieldRemoved', self, { amount: entry.amount, name });
      case 'freezeResolved':
        return this.pick('freezeResolved', self, { count: entry.count, name });
      case 'freezeApplied':
        return this.pick('freezeApplied', self, { amount: entry.amount, name });
      case 'poisonApplied':
        return this.pick('poisonApplied', self, { amount: entry.amount, name });
      case 'spellCast':
        return this.pick('spellCast', self, { spell: this.spellName(entry.spellId), name });
      case 'spellCreated':
        return this.pick('spellCreated', self, { spell: this.spellName(entry.spellId), name });
      case 'combined':
        return entry.kind === 'residue'
          ? this.pick('combinedResidue', self, { name })
          : this.pick('combined', self, { element: this.i18n.elementLabel(entry.element), name });
      case 'wandTipHeld':
        return this.pick('wandTipHeld', self, {
          element: this.i18n.elementLabel(entry.element),
          name,
        });
      case 'wandSocketed':
        return this.pick(entry.slot === 'body' ? 'wandSocketedBody' : 'wandSocketedHandle', self, {
          element: this.i18n.elementLabel(entry.element),
          name,
        });
      case 'wandResistanceTriggered':
        return this.pick(entry.outcome === 'resisted' ? 'wandResisted' : 'wandVulnerable', self, {
          name,
        });
      case 'handRevealed':
        return this.pick(entry.full ? 'handRevealedFull' : 'handRevealedPartial', self, { name });
      case 'opponentForcedDiscard':
        return this.pick(entry.full ? 'forcedDiscardFull' : 'forcedDiscardCount', self, {
          count: entry.count,
          name,
        });
      case 'fonteReset':
        return this.pick('fonteReset', self, { name });
      // Filtrata da visibleEntries sopra prima di arrivare qui — il case esiste solo per
      // l'esaustività dello switch su GameLogEntryData.
      case 'cardCollected':
        return '';
    }
  }
}
