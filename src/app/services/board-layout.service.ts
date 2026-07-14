import { Injectable, computed, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export type BoardLayoutTier = 'mobile' | 'tablet' | 'desktop';

/** Soglie standard (Tailwind sm/lg) — 'mobile' sotto i 640px usa lo stack verticale compatto,
 * 'tablet' tra 640 e 1023px la variante a due colonne (mano+bacchetta affiancate), 'desktop' da
 * 1024px in su eredita il layout esistente invariato (già verificato reggere anche su tablet
 * landscape di fascia alta, es. iPad Pro 12.9" a ~1366px). Solo larghezza: i casi "largo ma
 * basso" (telefono in landscape) sono già filtrati a monte da UnsupportedViewportComponent, che
 * blocca prima ancora di arrivare qui. */
const MOBILE_QUERY = '(max-width: 639px)';
const TABLET_QUERY = '(min-width: 640px) and (max-width: 1023px)';

@Injectable({ providedIn: 'root' })
export class BoardLayoutService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  private readonly isMobile = toSignal(
    this.breakpointObserver.observe(MOBILE_QUERY).pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  private readonly isTablet = toSignal(
    this.breakpointObserver.observe(TABLET_QUERY).pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  readonly tier = computed<BoardLayoutTier>(() => {
    if (this.isMobile()) return 'mobile';
    if (this.isTablet()) return 'tablet';
    return 'desktop';
  });
}
