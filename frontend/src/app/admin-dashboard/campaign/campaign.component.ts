import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
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
  readonly campaign = input.required<Campaign>();
  readonly viewState = input.required<'dashboard' | 'summary'>();
  readonly reloadEvent = output<string>();

  onReloadEvent(value: string) {
    this.reloadEvent.emit(value);
  }
}
