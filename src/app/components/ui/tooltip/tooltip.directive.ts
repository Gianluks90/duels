import { Directive, ElementRef, TemplateRef, ComponentRef, inject, input, DestroyRef } from '@angular/core';
import { Overlay, OverlayRef, type ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { Subscription } from 'rxjs';
import { TooltipComponent } from './tooltip.component';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/** Each side tries its natural spot first, then flips to the opposite side if there's no room. */
const POSITIONS: Record<TooltipPosition, ConnectedPosition[]> = {
  top: [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ],
  bottom: [
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
  ],
  left: [
    { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
    { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
  ],
  right: [
    { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
    { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
  ],
};

let nextId = 0;

/** Generic hover/focus/touch tooltip: attach to any element, content is plain text or a template — positioning (incl. keeping it on screen) is handled by the CDK overlay. */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'hide()',
    // A click usually triggers an action elsewhere (e.g. opening a dialog) without
    // moving the mouse or reliably blurring the trigger — without this the tooltip
    // is left dangling, stuck open behind whatever the click just opened. Routed through
    // onClick() (not hide() directly) so a touch tap's synthetic click doesn't immediately
    // close what onTouchStart() just opened — see suppressNextClickHide below.
    '(click)': 'onClick()',
    // Touch never fires mouseenter — without this, tooltips are simply unreachable on
    // touch-only devices. A tap ON the trigger toggles it open/closed; a tap elsewhere
    // closes it (outsidePointerEvents() in show(), below).
    '(touchstart)': 'onTouchStart()',
  },
})
export class TooltipDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  /** Falsy (empty string / null) means "nothing to show" — the directive stays silent instead of popping an empty bubble. */
  appTooltip = input<string | TemplateRef<unknown> | null>(null);
  tooltipPosition = input<TooltipPosition>('top');
  tooltipWidth = input(200);

  private readonly tooltipId = `tooltip-${nextId++}`;
  private overlayRef: OverlayRef | null = null;
  private outsideSub: Subscription | null = null;
  /** True for exactly one click right after onTouchStart() opens the tooltip — the browser's
   * synthetic click that follows a tap must not immediately re-close what the tap just opened. */
  private suppressNextClickHide = false;

  constructor() {
    this.elementRef.nativeElement.setAttribute('aria-describedby', this.tooltipId);
    this.destroyRef.onDestroy(() => this.hide());
  }

  protected show(): void {
    const content = this.appTooltip();
    if (!content || this.overlayRef) return;

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions(POSITIONS[this.tooltipPosition()])
      .withViewportMargin(8)
      .withPush(true);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    const componentRef: ComponentRef<TooltipComponent> = this.overlayRef.attach(new ComponentPortal(TooltipComponent));
    componentRef.setInput('content', content);
    componentRef.setInput('width', this.tooltipWidth());
    componentRef.setInput('tooltipId', this.tooltipId);

    // Tap/click ANYWHERE outside the tooltip bubble closes it — the main touch dismiss path,
    // since there's no touch equivalent of mouseleave. Taps on the trigger itself are excluded
    // here (left to onTouchStart()'s own toggle) to avoid a race between the two: this fires on
    // pointerdown for any target outside the overlay pane, which includes the trigger.
    this.outsideSub = this.overlayRef.outsidePointerEvents().subscribe((event) => {
      if (this.elementRef.nativeElement.contains(event.target as Node)) return;
      this.hide();
    });
  }

  protected hide(): void {
    this.outsideSub?.unsubscribe();
    this.outsideSub = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  protected onTouchStart(): void {
    if (this.overlayRef) {
      this.hide();
      return;
    }
    this.suppressNextClickHide = true;
    this.show();
  }

  protected onClick(): void {
    if (this.suppressNextClickHide) {
      this.suppressNextClickHide = false;
      return;
    }
    this.hide();
  }
}
