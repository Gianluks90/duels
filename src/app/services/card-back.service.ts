import { Injectable, signal } from '@angular/core';

/**
 * Dorsi carta disponibili — id da public/config/card-backs.json, ognuno con un'immagine
 * `/cards-back/<id>.webp`. Aggiungere un dorso nuovo è solo un file immagine + una riga JSON,
 * nessun codice TS da toccare (vedi CardBackSkin in player.model.ts).
 */
@Injectable({ providedIn: 'root' })
export class CardBackService {
  readonly options = signal<readonly string[]>([]);

  constructor() {
    void this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const res = await fetch('/config/card-backs.json');
      this.options.set((await res.json()) as string[]);
    } catch {
      this.options.set([]);
    }
  }
}
