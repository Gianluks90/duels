import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService, type GameDoc } from '../../services/game.service';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ObjectiveCardComponent } from '../../components/objective-card/objective-card.component';
import { OBJECTIVE_CATALOG } from '../../data/objectives';
import { buildObjectiveProgress, buildProgressSource } from '../../game/achievements';
import type { PlayerId } from '../../models/player.model';

@Component({
  selector: 'app-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe, ObjectiveCardComponent],
  templateUrl: './result.component.html',
  styleUrl: './result.component.scss',
})
export class ResultComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(TranslationService);

  protected readonly gameDoc = signal<GameDoc | null>(null);

  private readonly myRole = computed<PlayerId | null>(() => {
    const doc = this.gameDoc();
    const uid = this.auth.user()?.uid;
    if (!doc || !uid) return null;
    if (doc.hostId === uid) return 'host';
    if (doc.guestId === uid) return 'guest';
    return null;
  });

  /** null sia prima che i dati siano pronti sia per un vero pareggio (GameState.winner rimane null
   * quando entrambi i giocatori sono scesi a 0 hp nello stesso reducer, v. resolveVictory in
   * turn-engine.ts) — il template tratta già `null` come terzo esito ("Duello concluso"), non solo
   * come "sconosciuto". */
  protected readonly isWinner = computed(() => {
    const winner = this.gameDoc()?.state?.winner;
    const role = this.myRole();
    if (!winner || !role) return null;
    return winner === role;
  });

  /** Colonna achievement (Qualità della vita/Achievements): progresso di TUTTO il catalogo, non
   * solo quanto appena maturato in questa partita — vedere anche gli obiettivi lontani dalla soglia
   * è parte dell'idea originale ("colonna dedicata agli obiettivi in svolgimento"). */
  protected readonly objectivesProgress = computed(() => {
    const profile = this.auth.profile();
    return buildObjectiveProgress(
      OBJECTIVE_CATALOG,
      buildProgressSource(profile?.stats, profile ?? undefined),
      profile?.claimedObjectiveIds,
    );
  });

  constructor() {
    // Applica stats/obiettivi una volta che partita+ruolo sono noti — sicuro da rieseguire (ogni
    // snapshot di listenToGame rigira questo effect): AuthService.applyGameStats è no-op se
    // countedGames/{gameId} esiste già (v. il suo commento).
    effect(() => {
      const doc = this.gameDoc();
      const role = this.myRole();
      if (doc && role) void this.auth.applyGameStats(doc, role);
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('gameId') ?? '';
    this.game.listenToGame(id, (doc) => this.gameDoc.set(doc));
  }

  protected claimObjective(objectiveId: string): void {
    void this.auth.claimObjective(objectiveId);
  }

  protected goHome(): void {
    this.router.navigate(['/']);
  }
}
