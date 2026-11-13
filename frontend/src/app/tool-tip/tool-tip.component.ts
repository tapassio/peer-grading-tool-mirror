import { Component, Input, OnInit } from '@angular/core';
/**
 * the tooltip component is a component displays a box with a "?" sign
 * text is displayed when hovering over it
 */
@Component({
  selector: 'pgt-tool-tip',
  templateUrl: './tool-tip.component.html',
  styleUrls: ['./tool-tip.component.css'],
})
export class ToolTipComponent implements OnInit {
  @Input('text') text: string;
  @Input('icon') icon: string = 'help_outline';
  @Input('color') color: string = 'var(--tc-purple)';

  constructor() {}

  ngOnInit(): void {}
}
