import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { Campaign, CampaignStatus, Group } from '../interfaces';
import { CampaignService } from '../services/campaign.service';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'pgt-group-meta',
    templateUrl: './group-meta.component.html',
    styleUrls: ['./group-meta.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [DatePipe]
})
export class GroupMetaComponent {
  private campaignService = inject(CampaignService);

  readonly campaign = input.required<Campaign>();
  readonly group = input.required<Group>();
  readonly showCriteria = input(true);

  getCampaignStatus(): CampaignStatus {
    return this.campaignService.getCampaignStatus(this.campaign());
  }
}
