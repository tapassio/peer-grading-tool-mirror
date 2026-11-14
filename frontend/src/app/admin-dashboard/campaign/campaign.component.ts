import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { Campaign } from '../../interfaces';

@Component({
    selector: 'pgt-campaign',
    templateUrl: './campaign.component.html',
    styleUrls: ['./campaign.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CampaignComponent {
  @Input() campaign: Campaign;
  @Input() viewState: 'dashboard' | 'summary';
  @Output() reloadEvent: EventEmitter<string> = new EventEmitter<string>();

  onReloadEvent(value: string) {
    this.reloadEvent.emit(value);
  }
}
