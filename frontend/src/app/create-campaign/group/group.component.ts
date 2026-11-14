import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
export class GroupComponent implements OnInit {
  @Input('group') group: Group;
  @Input('campaign') campaign: Campaign;
  @Input('campaignStatus') campaignStatus: CampaignStatus;

  peerForm: FormGroup;

  constructor(private createCampaignService: CreateCampaignService) {}

  ngOnInit(): void {}

  removeGroup() {
    this.createCampaignService.removeGroup(this.group);
  }

  addPeer() {
    this.createCampaignService.addPeer(this.group);
  }
}
