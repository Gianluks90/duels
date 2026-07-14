import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UnsupportedViewportComponent } from './components/unsupported-viewport/unsupported-viewport.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UnsupportedViewportComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block; width: 100%; height: 100dvh;' },
  styleUrl: './app.scss',
})
export class App {}
