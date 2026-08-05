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
import { FriendsService } from '../../services/friends.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { ObjectiveCardComponent } from '../../components/objective-card/objective-card.component';
import { GameLogListComponent } from '../../components/game-log-list/game-log-list.component';
import { OBJECTIVE_CATALOG } from '../../data/objectives';
import {
  buildObjectiveProgress,
  buildProgressSource,
  matchAffectedMetrics,
  type ObjectiveProgress,
} from '../../game/achievements';
import { OBJECTIVES_TRACKING_ENABLED } from '../../environment/feature-flags';
import type { PlayerId } from '../../models/player.model';
import type { ObjectiveMetric } from '../../models/objective.model';

type ResultTab = 'objectives' | 'log';

@Component({
  selector: 'app-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe, AppHeaderComponent, ObjectiveCardComponent, GameLogListComponent],
  templateUrl: './result.component.html',
  styleUrl: './result.component.scss',
})
export class ResultComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly friendsService = inject(FriendsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(TranslationService);

  /** v. environment/feature-flags.ts — mostra un overlay sopra la griglia obiettivi finché resta
   * `false` (beta, o una futura ri-disattivazione), stesso avviso di ObjectivesComponent
   * (objectives.trackingDisabledWarning): il progresso appena maturato non viene tracciato davvero
   * (v. AuthService.applyGameStats), quindi qui non c'è nulla di reale da mostrare. */
  protected readonly objectivesTrackingEnabled = OBJECTIVES_TRACKING_ENABLED;

  protected readonly gameDoc = signal<GameDoc | null>(null);

  protected readonly myRole = computed<PlayerId | null>(() => {
    const doc = this.gameDoc();
    const uid = this.auth.user()?.uid;
    if (!doc || !uid) return null;
    if (doc.hostId === uid) return 'host';
    if (doc.guestId === uid) return 'guest';
    return null;
  });

  /** Stessa logica di BoardComponent.playerName/opponentName — nome, foto e titolo equipaggiato
   * mostrati nel riquadro "Dettagli duello", risolti dallo SNAPSHOT preso in GameDoc al join
   * (hostPhoto/hostTitle/guestPhoto/guestTitle), non dal profilo live: rispecchiano esattamente cosa
   * si è visto durante QUESTO duello (stesso dato già mostrato dal player-hud in game), non un
   * eventuale cambio titolo/foto fatto subito dopo. */
  protected readonly playerName = computed(() => {
    const doc = this.gameDoc();
    const you = this.i18n.t('board.you');
    if (!doc) return you;
    return this.myRole() === 'host' ? doc.hostName : (doc.guestName ?? you);
  });

  protected readonly opponentName = computed(() => {
    const doc = this.gameDoc();
    const opponent = this.i18n.t('board.opponent');
    if (!doc) return opponent;
    return this.myRole() === 'host' ? (doc.guestName ?? opponent) : doc.hostName;
  });

  protected readonly playerPhoto = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    return this.myRole() === 'host' ? doc.hostPhoto : doc.guestPhoto;
  });

  protected readonly opponentPhoto = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    return this.myRole() === 'host' ? doc.guestPhoto : doc.hostPhoto;
  });

  /** Titolo equipaggiato (v. ProfileComponent.displayTitle, stessa risoluzione variant-id → testo)
   * — `null` se lo snapshot non ne aveva uno, la card mostra solo nome/foto. */
  protected readonly playerTitleLabel = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    const titleId = this.myRole() === 'host' ? doc.hostTitle : doc.guestTitle;
    return titleId ? this.i18n.titleLabel(titleId) : null;
  });

  protected readonly opponentTitleLabel = computed(() => {
    const doc = this.gameDoc();
    if (!doc) return null;
    const titleId = this.myRole() === 'host' ? doc.guestTitle : doc.hostTitle;
    return titleId ? this.i18n.titleLabel(titleId) : null;
  });

  private readonly opponentUid = computed(() => {
    const doc = this.gameDoc();
    const role = this.myRole();
    if (!doc || !role) return null;
    return role === 'host' ? doc.guestId : doc.hostId;
  });

  /** `null` finché non ancora determinato (o nessun avversario noto) — il bottone "Richiedi
   * amicizia" resta nascosto finché non sappiamo con certezza che NON lo è già, mai mostrato "a
   * lampeggio" durante il caricamento. Interrogato fresco via FriendsService.isFriend() invece di
   * fidarsi di GameDoc.wasFriendDuel (quello è lo snapshot preso AL JOIN, potrebbero essere
   * diventati amici durante la partita). */
  protected readonly isOpponentFriend = signal<boolean | null>(null);

  /** Feedback temporaneo sul bottone "Richiedi amicizia" — stesso schema di
   * ProfileComponent.friendRequestSent (si azzera da solo dopo 2s). */
  protected readonly friendRequestSent = signal(false);

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

  /** Progresso di TUTTO il catalogo — filtrato poi in matchObjectives sotto, mai mostrato per
   * intero qui: quella è la pagina Obiettivi dedicata, non questa colonna a fine partita. */
  protected readonly objectivesProgress = computed(() => {
    const profile = this.auth.profile();
    return buildObjectiveProgress(
      OBJECTIVE_CATALOG,
      buildProgressSource(profile?.stats, profile ?? undefined),
      profile?.claimedObjectiveIds,
    );
  });

  /** Metriche toccate da QUESTA partita — ricostruite dall'eventLog/esito (v.
   * game/achievements.ts.matchAffectedMetrics), non da un confronto prima/dopo sul profilo: quel
   * confronto sarebbe corretto solo appena finita la partita, non se si riapre questa pagina in una
   * sessione successiva quando `auth.profile()` riflette già molte partite oltre questa. Insieme
   * vuoto finché ruolo/eventLog non sono ancora noti. */
  private readonly affectedMetrics = computed(() => {
    const doc = this.gameDoc();
    const role = this.myRole();
    if (!doc?.state || !role) return new Set<ObjectiveMetric>();
    return matchAffectedMetrics(
      doc.state.eventLog,
      role,
      doc.state.winner,
      doc.wasFriendDuel,
      doc.state.players[role],
    );
  });

  /** Tab "Obiettivi" (default, v. activeTab sotto): solo gli obiettivi TOCCATI da questa partita e
   * non ancora riscattati — un obiettivo già riscattato in precedenza (es. `wins` tocca `win_10` a
   * ogni vittoria, ma quel traguardo può essere già stato incassato da tempo) non è più "nuovo" per
   * questa partita, è rumore. Niente vista "tutti gli altri obiettivi" qui: quella è la pagina
   * Obiettivi dedicata (route /objectives), non questa colonna a fine partita. */
  protected readonly matchObjectives = computed<ObjectiveProgress[]>(() => {
    const metrics = this.affectedMetrics();
    return this.objectivesProgress().filter(
      (item) => metrics.has(item.objective.metric) && !item.claimed,
    );
  });

  /** "Obiettivi" acceso di default: è la ragione stessa per cui questa colonna esiste a fine
   * duello, il log ("Eventi partita") è consultazione facoltativa. */
  protected readonly activeTab = signal<ResultTab>('objectives');

  protected selectTab(tab: ResultTab): void {
    this.activeTab.set(tab);
  }

  constructor() {
    // Applica stats/obiettivi una volta che partita+ruolo sono noti — sicuro da rieseguire (ogni
    // snapshot di listenToGame rigira questo effect): AuthService.applyGameStats è no-op se
    // countedGames/{gameId} esiste già (v. il suo commento).
    effect(() => {
      const doc = this.gameDoc();
      const role = this.myRole();
      if (doc && role) void this.auth.applyGameStats(doc, role);
    });

    // Amicizia con l'avversario — interrogata fresca (v. isOpponentFriend sopra) ogni volta che
    // cambia, non solo alla prima risoluzione: se si accetta la richiesta da un'altra scheda mentre
    // questa pagina resta aperta, il bottone deve sparire senza bisogno di un refresh.
    effect(() => {
      const myUid = this.auth.user()?.uid;
      const uid = this.opponentUid();
      if (!myUid || !uid) {
        this.isOpponentFriend.set(null);
        return;
      }
      void this.friendsService.isFriend(myUid, uid).then((isFriend) => {
        this.isOpponentFriend.set(isFriend);
      });
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('gameId') ?? '';
    // Questa pagina ha senso solo a partita conclusa — né le regole Firestore (games/{gameId} resta
    // leggibile da host/guest a qualunque status) né authGuard (controlla solo l'autenticazione)
    // impediscono di arrivarci con l'URL a mano mentre la partita è ancora in corso, quindi il
    // controllo va fatto qui: si torna alla board finché lo status non è 'finished'.
    const unsub = this.game.listenToGame(id, (doc) => {
      this.gameDoc.set(doc);
      if (doc && doc.status !== 'finished') {
        unsub();
        this.router.navigate(['/game', id]);
      }
    });
  }

  protected claimObjective(objectiveId: string): void {
    void this.auth.claimObjective(objectiveId);
  }

  /** Manda una richiesta di amicizia diretta all'avversario — stesso FriendsService.sendRequest()
   * di ProfileComponent.addFriend/FriendsComponent.sendRequest. */
  protected async addFriend(): Promise<void> {
    const myProfile = this.auth.profile();
    const uid = this.opponentUid();
    if (!myProfile || !uid) return;

    try {
      await this.friendsService.sendRequest(myProfile, uid);
      this.friendRequestSent.set(true);
      setTimeout(() => this.friendRequestSent.set(false), 2000);
    } catch {
      // v. ProfileComponent.addFriend — nessuno stato di errore dedicato, stessa eccezione rara
      // silenziosamente ignorata di un doppio click.
    }
  }

  /** "Esci" — cancella il documento partita (v. GameService.deleteGame, regole Firestore
   * games/{gameId}: host sempre, guest solo a partita 'finished' com'è qui) prima di tornare alla
   * Home, non solo un `router.navigate`: senza, ogni duello concluso resterebbe per sempre in
   * Firestore. Naviga via comunque anche se la cancellazione fallisce (v. addFriend sopra — nessuno
   * stato di errore dedicato, l'uscita non deve restare bloccata da un'eccezione rara). */
  protected async goHome(): Promise<void> {
    const id = this.gameDoc()?.id;
    if (id) {
      try {
        await this.game.deleteGame(id);
      } catch {
        // v. sopra.
      }
    }
    this.router.navigate(['/']);
  }
}
