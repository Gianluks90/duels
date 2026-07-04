import { Directive, ElementRef, TemplateRef, ComponentRef, inject, input, DestroyRef } from '@angular/core';
import { Overlay, OverlayRef, type ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
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

/** Generic hover/focus tooltip: attach to any element, content is plain text or a template — positioning (incl. keeping it on screen) is handled by the CDK overlay. */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'hide()',
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

  constructor() {
    this.elementRef.nativeElement.setAttribute('aria-describedby', this.tooltipId);
    this.destroyRef.onDestroy(() => this.overlayRef?.dispose());
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
  }

  protected hide(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
