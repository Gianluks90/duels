import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-icon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
})
export class IconButtonComponent {
  /** Path to the icon (e.g. `/icons/book_2_24dp_....svg`); masked and tinted gold. */
  icon = input.required<string>();
  ariaLabel = input.required<string>();
  size = input(44);

  iconClick = output<void>();

  protected readonly iconUrl = computed(() => `url('${this.icon()}')`);
}
