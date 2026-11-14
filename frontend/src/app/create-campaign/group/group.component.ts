import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Group, Campaign, CampaignStatus } from 'src/app/interfaces';
import { CreateCampaignService } from '../create-campaign.service';

@Component({
    selector: 'pgt-group',
    templateUrl: './group.component.html',
    styleUrls: ['../../app.component.css', './group.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class GroupComponent {
  @Input() group: Group;
  @Input() campaign: Campaign;
  @Input() campaignStatus: CampaignStatus;

  peerForm: FormGroup;

  constructor(private createCampaignService: CreateCampaignService) {}

  removeGroup() {
    this.createCampaignService.removeGroup(this.group);
  }

  addPeer() {
    this.createCampaignService.addPeer(this.group);
  }
}
