import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

/** Chiavi dei singoli effetti sonori — una per evento di gioco che ne richiede uno, non un pool generico: a differenza della playlist musicale (intercambiabile, casuale), ogni fx ha un innesco preciso e va referenziato per nome dal chiamante (board.component.ts). */
export type FxKey = 'fonteReveal' | 'handDraw';

interface AudioConfig {
  /** Unico brano per login+home — mai riavviato al passaggio tra le due (onNavigation è no-op se la modalità non cambia). */
  menuTrack: string;
  /** Musiche di sottofondo in partita — ordine rimescolato una volta per ogni ingresso in game/:id. Aggiungere un suono nuovo = aggiungere un percorso qui, nessun codice da toccare. */
  playlist: string[];
  /** Effetti sonori puntuali (fx), stesso principio: un percorso in più qui per un fx nuovo. */
  fx: Partial<Record<FxKey, string>>;
}

interface PlayFxOptions {
  /** Quante volte riprodurlo in rapida sequenza (es. 5 flip per una mano di 5 carte) — default 1. */
  times?: number;
  /** Intervallo tra una riproduzione e la successiva quando times > 1 — default 120ms, abbastanza perché si sentano come colpi distinti invece che un'unica nota sovrapposta. */
  intervalMs?: number;
}

type PlaybackMode = 'menu' | 'game';

const MUSIC_STORAGE_KEY = 'duels.audio.music';
const FX_STORAGE_KEY = 'duels.audio.fx';
const MUSIC_VOLUME = 0.4;
const FX_VOLUME = 0.5;

/**
 * Audio dell'app — musica di sottofondo ed effetti sonori, due toggle indipendenti ma un solo
 * servizio (nessun bisogno di separarli: gli fx non hanno bisogno di seguire la rotta come la
 * musica, sono innescati puntualmente dal chiamante). La musica usa un solo elemento <audio>
 * condiviso, pilotato dalla rotta corrente (Router.events) invece che dai singoli componenti
 * pagina: login e home condividono la stessa modalità 'menu' (onNavigation è no-op se la modalità
 * non cambia — risolve "nessun restart dopo il login" senza bisogno di casi speciali), game/:id
 * passa alla playlist casuale, ogni altra rotta (setup, result, ...) torna al brano del menu. Gli
 * fx invece creano un nuovo elemento <audio> a ogni riproduzione (playFx), così ripetizioni
 * ravvicinate (es. 5 flip) o sovrapposte non si tagliano a vicenda come farebbero condividendo un
 * solo elemento. Istanziato una sola volta all'avvio dell'app (inject(AudioService) nel componente
 * App radice) così la sottoscrizione al router è già attiva dalla primissima navigazione.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly router = inject(Router);
  private readonly music = new Audio();

  private config: AudioConfig | null = null;
  private mode: PlaybackMode | null = null;
  private shuffledPlaylist: string[] = [];
  private playlistIndex = 0;
  /** Handler dell'eventuale listener "riprova al primo click" in attesa per la musica — al più uno alla volta. Gli fx non ne hanno bisogno: per quando ne serve uno, l'utente ha già interagito con la pagina almeno una volta (vedi playFx). */
  private pendingAutoplayRetry: (() => void) | null = null;

  /** true di default, o il valore salvato dall'utente — persistente tra sessioni (localStorage), indipendente da fxEnabled. */
  readonly musicEnabled = signal<boolean>(readStoredFlag(MUSIC_STORAGE_KEY));
  readonly fxEnabled = signal<boolean>(readStoredFlag(FX_STORAGE_KEY));

  constructor() {
    this.music.volume = MUSIC_VOLUME;
    this.music.addEventListener('ended', () => this.onTrackEnded());

    // Sottoscritto subito, PRIMA che il config sia pronto — altrimenti la primissima NavigationEnd
    // (login o home, a seconda dell'authGuard) rischierebbe di sfuggire mentre fetch() è ancora in
    // volo. onNavigation stesso ignora le chiamate finché this.config è null.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.onNavigation(e.urlAfterRedirects));

    void this.loadConfig().then(() => this.onNavigation(this.router.url));
  }

  toggleMusic(): void {
    const next = !this.musicEnabled();
    this.musicEnabled.set(next);
    localStorage.setItem(MUSIC_STORAGE_KEY, String(next));
    if (next) this.resumeMusic();
    else this.music.pause();
  }

  toggleFx(): void {
    const next = !this.fxEnabled();
    this.fxEnabled.set(next);
    localStorage.setItem(FX_STORAGE_KEY, String(next));
  }

  /** No-op se gli fx sono disattivi o se `key` non ha un percorso configurato (public/config/audio.json). Ogni chiamata crea un nuovo <audio>, così `times` > 1 (o due fx diversi quasi simultanei) non si interrompono a vicenda. */
  playFx(key: FxKey, options?: PlayFxOptions): void {
    if (!this.fxEnabled()) return;
    const src = this.config?.fx[key];
    if (!src) return;

    const times = options?.times ?? 1;
    const intervalMs = options?.intervalMs ?? 120;
    for (let i = 0; i < times; i++) {
      setTimeout(() => this.playFxOnce(src), i * intervalMs);
    }
  }

  private playFxOnce(src: string): void {
    const audio = new Audio(src);
    audio.volume = FX_VOLUME;
    // Autoplay bloccato non è un problema realistico qui: un fx scatta sempre in risposta a un
    // cambiamento di stato di gioco, quindi l'utente ha già cliccato qualcosa almeno una volta
    // prima che questo punto sia mai raggiunto — a differenza della musica, che può dover partire
    // sulla primissima pagina (login) prima di qualunque interazione.
    void audio.play().catch(() => {});
  }

  private onNavigation(url: string): void {
    if (!this.config) return;

    const nextMode: PlaybackMode = url.startsWith('/game/') ? 'game' : 'menu';
    if (nextMode === this.mode) return;
    this.mode = nextMode;

    if (nextMode === 'game') this.startPlaylist();
    else this.startMenuTrack();
  }

  private startMenuTrack(): void {
    if (!this.config?.menuTrack) return;
    this.setSrc(this.config.menuTrack);
  }

  /** Rimescolata a ogni NUOVO ingresso in modalità 'game' (onNavigation la richiama solo al cambio di modalità, non a ogni navigazione) — una playlist diversa a ogni partita. */
  private startPlaylist(): void {
    if (!this.config || this.config.playlist.length === 0) return;
    this.shuffledPlaylist = shuffle(this.config.playlist);
    this.playlistIndex = 0;
    this.setSrc(this.shuffledPlaylist[0]);
  }

  private onTrackEnded(): void {
    if (this.mode === 'menu') {
      this.resumeMusic(); // loop dello stesso brano
      return;
    }
    if (this.shuffledPlaylist.length === 0) return;
    this.playlistIndex = (this.playlistIndex + 1) % this.shuffledPlaylist.length;
    this.setSrc(this.shuffledPlaylist[this.playlistIndex]);
  }

  private setSrc(src: string): void {
    this.music.src = src;
    this.resumeMusic();
  }

  /** No-op se la musica è disattiva dall'utente. Se il browser blocca l'autoplay (nessuna interazione ancora avvenuta, tipicamente al primo arrivo su /login), riprova al primo click ovunque sulla pagina — nessun elemento UI dedicato, come da richiesta. */
  private resumeMusic(): void {
    if (!this.musicEnabled()) return;

    this.music.play().catch(() => {
      if (this.pendingAutoplayRetry) return;
      const retry = () => {
        document.removeEventListener('click', retry);
        this.pendingAutoplayRetry = null;
        void this.music.play();
      };
      this.pendingAutoplayRetry = retry;
      document.addEventListener('click', retry, { once: true });
    });
  }

  private async loadConfig(): Promise<void> {
    try {
      const res = await fetch('/config/audio.json');
      this.config = (await res.json()) as AudioConfig;
    } catch {
      this.config = { menuTrack: '', playlist: [], fx: {} };
    }
  }
}

function readStoredFlag(key: string): boolean {
  return localStorage.getItem(key) !== 'false';
}

/** Fisher-Yates — non muta l'array in input (SPELL_CATALOG-style: i chiamanti non si aspettano side-effect). */
function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
