import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';

export interface SelectOption<T> {
  value: T;
  label: string;
  /** Path to an icon (e.g. elementIconPath(el)); shown before the label, both in the trigger (for the current value) and in each menu row. Omit for options with no icon (e.g. sort modes). */
  icon?: string;
}

/**
 * Single-choice dropdown built on CDK Menu (same trigger+ng-template shell as ActionMenuComponent) —
 * not a native <select>, which can't render an icon per option and whose native styling varies too
 * much across browsers for this use case. Generic over T so one component covers both an
 * icon-per-option filter (e.g. element) and a plain-label one (e.g. sort mode).
 */
@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
})
export class SelectComponent<T> {
  options = input.required<SelectOption<T>[]>();
  value = input<T | null>(null);
  ariaLabel = input.required<string>();
  /** 'light' for use on a light/parchment background (Grimoire) — the CDK menu panel is portaled outside this component's DOM subtree, so a parent's CSS custom properties/scoped styles can't reach it; the two look-and-feel variants live entirely inside this component instead. */
  variant = input<'dark' | 'light'>('dark');

  valueChange = output<T>();

  protected readonly selected = computed<SelectOption<T> | null>(
    () => this.options().find(o => o.value === this.value()) ?? null,
  );

  protected choose(option: SelectOption<T>): void {
    this.valueChange.emit(option.value);
  }
}
