import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
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

  @Input() campaign: Campaign;
  @Input() group: Group;
  @Input() showCriteria = true;

  getCampaignStatus(): CampaignStatus {
    return this.campaignService.getCampaignStatus(this.campaign);
  }
}
