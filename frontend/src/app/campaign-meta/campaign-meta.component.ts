import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Campaign, CampaignStatus, Grading } from '../interfaces';
import { CampaignService } from '../services/campaign.service';

@Component({
    selector: 'pgt-campaign-meta',
    templateUrl: './campaign-meta.component.html',
    styleUrls: ['./campaign-meta.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CampaignMetaComponent implements OnInit {
  @Input('campaign') campaign: Campaign;
  @Input('showName') showName: boolean = false;
  @Input('viewState') viewState: 'dashboard' | 'summary';

  constructor(private campaignService: CampaignService) {}

  ngOnInit(): void {}

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
