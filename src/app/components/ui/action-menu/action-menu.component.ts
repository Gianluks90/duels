import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';

export interface ActionMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

/** Wraps any content (a card, a pile, ...) with a click-to-open CDK menu of commands — the wrapped content itself stays untouched/agnostic. */
@Component({
  selector: 'app-action-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger],
  templateUrl: './action-menu.component.html',
  styleUrl: './action-menu.component.scss',
})
export class ActionMenuComponent {
  items = input.required<ActionMenuItem[]>();
}
