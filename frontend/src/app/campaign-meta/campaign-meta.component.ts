import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { Campaign, CampaignStatus } from '../interfaces';
import { CampaignService } from '../services/campaign.service';
import { UpperCasePipe, DatePipe } from '@angular/common';
import { CampaignStatusPipe } from '../pipes/campaign-status.pipe';

@Component({
    selector: 'pgt-campaign-meta',
    templateUrl: './campaign-meta.component.html',
    styleUrls: ['./campaign-meta.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [UpperCasePipe, DatePipe, CampaignStatusPipe]
})
export class CampaignMetaComponent {
  private campaignService = inject(CampaignService);

  readonly campaign = input.required<Campaign>();
  readonly showName = input(false);
  // not every page passes it (e.g. the user list)
  readonly viewState = input<'dashboard' | 'summary'>();

  getCampaignStatus(): CampaignStatus {
    return this.campaignService.getCampaignStatus(this.campaign());
  }

  countPeers(): number {
    return this.campaignService.countPeers(this.campaign());
  }

  countCompletedPeers(): number {
    return this.campaignService.countCompletedPeers(this.campaign());
  }

  getCompletionPercentage(): number {
    return this.campaignService.getCompletionPercentage(this.campaign());
  }
}
