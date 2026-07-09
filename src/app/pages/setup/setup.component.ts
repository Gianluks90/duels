import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GameService, type GameDoc } from '../../services/game.service';
import { GameEngineService } from '../../services/game-engine.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly gameEngine = inject(GameEngineService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(TranslationService);

  protected readonly gameId = signal<string>('');
  protected readonly gameDoc = signal<GameDoc | null>(null);
  protected readonly saving = signal(false);
  /** Evita di richiedere tryStartGame ad ogni singolo tick di onSnapshot mentre l'avvio è già in corso. */
  private startRequested = false;

  protected readonly myRole = computed<'host' | 'guest' | null>(() => {
    const doc = this.gameDoc();
    const uid = this.auth.user()?.uid;
    if (!doc || !uid) return null;
    if (doc.hostId === uid) return 'host';
    if (doc.guestId === uid) return 'guest';
    return null;
  });

  protected readonly iAmReady = computed(() => {
    const doc = this.gameDoc();
    const role = this.myRole();
    if (!doc || !role) return false;
    return role === 'host' ? doc.hostReady : doc.guestReady;
  });

  protected readonly opponentName = computed(() => {
    const doc = this.gameDoc();
    const role = this.myRole();
    if (!doc || !role) return null;
    return role === 'host' ? doc.guestName : doc.hostName;
  });

  protected readonly opponentReady = computed(() => {
    const doc = this.gameDoc();
    const role = this.myRole();
    if (!doc || !role) return false;
    return role === 'host' ? doc.guestReady : doc.hostReady;
  });

  protected readonly waitingText = computed(() => {
    const name = this.opponentName();
    return this.i18n.t('setup.ready.waitingFor', { name: name ?? this.i18n.t('setup.ready.opponentFallback') });
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('gameId') ?? '';
    this.gameId.set(id);

    const unsub = this.game.listenToGame(id, doc => {
      this.gameDoc.set(doc);
      if (doc?.status === 'playing') {
        unsub();
        this.router.navigate(['/game', id]);
        return;
      }
      // Solo l'host prova ad avviare la partita, per evitare che entrambi i client corrano a scriverla insieme.
      if (!this.startRequested && doc?.status === 'setup' && doc.hostReady && doc.guestReady && this.myRole() === 'host') {
        this.startRequested = true;
        void this.gameEngine.tryStartGame(id);
      }
    });

    this.destroyRef.onDestroy(() => unsub());
  }

  /** Asta e manico (1.4.2/1.4.3) partono sempre vuoti — si riempiono solo in partita con "Incastona" (socketElement in turn-engine.ts), mai qui: niente più scelta libera e gratuita a inizio partita. */
  protected async confirmWand(): Promise<void> {
    const role = this.myRole();
    if (!role) return;
    this.saving.set(true);
    try {
      await this.game.setReady(this.gameId(), role, {
        handleSocket: null,
        bodySocket: null,
        tipSlot: null,
      });
    } finally {
      this.saving.set(false);
    }
  }
}
