import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Campaign, CampaignStatus } from '../interfaces';
import { CampaignService } from '../services/campaign.service';

@Component({
    selector: 'pgt-campaign-meta',
    templateUrl: './campaign-meta.component.html',
    styleUrls: ['./campaign-meta.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CampaignMetaComponent {
  @Input() campaign: Campaign;
  @Input() showName = false;
  @Input() viewState: 'dashboard' | 'summary';

  constructor(private campaignService: CampaignService) {}

  getCampaignStatus(): CampaignStatus {
    return this.campaignService.getCampaignStatus(this.campaign);
  }

  countPeers(): number {
    return this.campaignService.countPeers(this.campaign);
  }

  countCompletedPeers(): number {
    return this.campaignService.countCompletedPeers(this.campaign);
  }

  getCompletionPercentage(): number {
    return this.campaignService.getCompletionPercentage(this.campaign);
  }
}
