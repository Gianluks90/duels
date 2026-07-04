import { Component, ChangeDetectionStrategy, TemplateRef, input, computed } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/** The bubble itself — positioning/show-hide is the tooltip directive's job. */
@Component({
  selector: 'app-tooltip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  templateUrl: './tooltip.component.html',
  styleUrl: './tooltip.component.scss',
})
export class TooltipComponent {
  content = input<string | TemplateRef<unknown>>('');
  width = input(200);
  tooltipId = input<string>('');

  protected readonly templateContent = computed(() => {
    const c = this.content();
    return c instanceof TemplateRef ? c : null;
  });

  protected readonly textContent = computed(() => {
    const c = this.content();
    return typeof c === 'string' ? c : null;
  });
}
