import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { DEFAULT_BACKGROUND_ID } from '../models/user.model';

export interface BackgroundOption {
  id: string;
  file: string;
}

const STORAGE_KEY = 'duels.background';

/**
 * Sfondo dell'app (body) — scelta persistita sul profilo utente (UserProfile.background,
 * AuthService), applicata qui globalmente via una custom property CSS (--app-background, letta da
 * `body` in _design-system.scss) invece che una classe per sfondo: un solo punto di sincronizzazione,
 * nessuna combinatoria di classi da gestire. Il set di sfondi disponibili vive in
 * public/config/backgrounds.json (stesso schema/pattern di audio.json) — aggiungere uno sfondo
 * nuovo è solo un file immagine + una riga JSON, nessun codice da toccare. Istanziato subito in
 * App (app.ts), come AudioService, così l'effect sotto è già attivo prima di qualunque navigazione.
 *
 * Il profilo Firestore resta l'unica fonte di verità — localStorage è solo una cache ottimistica
 * per il breve intervallo prima che AuthService risolva il profilo (o per un utente disconnesso):
 * appena il profilo carica, current() lo preferisce sempre, e il secondo effect sotto riallinea la
 * cache locale al valore reale, così un cambio fatto da un altro dispositivo non resta bloccato su
 * una scelta locale ormai stantia.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundService {
  private readonly auth = inject(AuthService);
  private readonly cachedBackground = localStorage.getItem(STORAGE_KEY);

  readonly options = signal<readonly BackgroundOption[]>([]);
  readonly current = computed(
    () => this.auth.profile()?.background ?? this.cachedBackground ?? DEFAULT_BACKGROUND_ID,
  );

  constructor() {
    void this.loadConfig();

    // Non applica nulla finché il config non è caricato (options() vuoto) — il fallback CSS su
    // `body` (stesso id di default) copre quella finestra, niente flash dello sfondo sbagliato.
    effect(() => {
      const option = this.options().find((o) => o.id === this.current());
      if (option) {
        document.body.style.setProperty('--app-background', `url('${option.file}')`);
      }
    });

    effect(() => {
      const background = this.auth.profile()?.background;
      if (background) localStorage.setItem(STORAGE_KEY, background);
    });
  }

  private async loadConfig(): Promise<void> {
    try {
      const res = await fetch('/config/backgrounds.json');
      this.options.set((await res.json()) as BackgroundOption[]);
    } catch {
      this.options.set([]);
    }
  }
}
