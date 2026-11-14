import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { Campaign } from '../../interfaces';
import { CampaignMetaComponent } from '../../campaign-meta/campaign-meta.component';
import { CampaignButtonsComponent } from '../../campaign-buttons/campaign-buttons.component';

@Component({
    selector: 'pgt-campaign',
    templateUrl: './campaign.component.html',
    styleUrls: ['./campaign.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [CampaignMetaComponent, CampaignButtonsComponent]
})
export class CampaignComponent {
  @Input() campaign: Campaign;
  @Input() viewState: 'dashboard' | 'summary';
  @Output() reloadEvent: EventEmitter<string> = new EventEmitter<string>();

  onReloadEvent(value: string) {
    this.reloadEvent.emit(value);
  }
}
