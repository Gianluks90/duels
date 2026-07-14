import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Sotto questa soglia nessun layout (nemmeno la variante mobile compatta) regge più: altezza
 * troppo bassa (telefono in landscape — la modalità volutamente non supportata, decisione presa
 * a parte dal design mobile) o una finestra desktop ridimensionata troppo in basso; oppure
 * larghezza sotto il floor minimo assoluto (telefoni molto vecchi/piccoli, <320px). */
const UNSUPPORTED_QUERY = '(max-height: 599px), (max-width: 319px)';

/** Overlay bloccante globale, montato una sola volta accanto al router-outlet (app.html) — copre
 * tutto lo schermo finché il viewport resta sotto la soglia minima, indipendentemente da quale
 * pagina/dialog sia aperta sotto (z-index sopra anche i dialog CDK, che usano 1000). */
@Component({
  selector: 'app-unsupported-viewport',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (unsupported()) {
      <div
        class="unsupported"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-label]="'unsupportedViewport.title' | translate"
      >
        <span class="unsupported__icon" aria-hidden="true">⤢</span>
        <h1 class="unsupported__title">{{ 'unsupportedViewport.title' | translate }}</h1>
        <p class="unsupported__body">{{ 'unsupportedViewport.body' | translate }}</p>
      </div>
    }
  `,
  styleUrl: './unsupported-viewport.component.scss',
})
export class UnsupportedViewportComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly unsupported = toSignal(
    this.breakpointObserver.observe(UNSUPPORTED_QUERY).pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}
