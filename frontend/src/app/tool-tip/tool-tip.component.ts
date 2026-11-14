import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
/**
 * the tooltip component is a component displays a box with a "?" sign
 * text is displayed when hovering over it
 */
@Component({
    selector: 'pgt-tool-tip',
    templateUrl: './tool-tip.component.html',
    styleUrls: ['./tool-tip.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatIcon, MatTooltip]
})
export class ToolTipComponent {
  readonly text = input.required<string>();
  readonly icon = input('help_outline');
  readonly color = input('var(--tc-purple)');

}
