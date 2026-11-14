import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Campaign, CampaignStatus, Group } from '../interfaces';
import { CampaignService } from '../services/campaign.service';

@Component({
    selector: 'pgt-group-meta',
    templateUrl: './group-meta.component.html',
    styleUrls: ['./group-meta.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GroupMetaComponent {
  @Input() campaign: Campaign;
  @Input() group: Group;
  @Input() showCriteria = true;

  constructor(private campaignService: CampaignService) {}

  getCampaignStatus(): CampaignStatus {
    return this.campaignService.getCampaignStatus(this.campaign);
  }
}
