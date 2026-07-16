import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UnsupportedViewportComponent } from './components/unsupported-viewport/unsupported-viewport.component';
import { AudioService } from './services/audio.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UnsupportedViewportComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block; width: 100%; height: 100dvh;' },
  styleUrl: './app.scss',
})
export class App {
  // Iniettato solo per costruire il servizio subito, prima di qualunque navigazione — AudioService
  // è providedIn: 'root', quindi Angular lo crea solo al primo inject() ovunque si trovi: qui
  // garantisce che la sua sottoscrizione al router sia già attiva dalla primissima rotta (login).
  private readonly audio = inject(AudioService);
}
