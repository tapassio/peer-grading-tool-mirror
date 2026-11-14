import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Group, Campaign, CampaignStatus } from 'src/app/interfaces';
import { CreateCampaignService } from '../create-campaign.service';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PeerComponent } from './peer/peer.component';

@Component({
    selector: 'pgt-group',
    templateUrl: './group.component.html',
    styleUrls: ['../../app.component.css', './group.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatButton, MatIcon, PeerComponent]
})
export class GroupComponent {
  private createCampaignService = inject(CreateCampaignService);

  @Input() group: Group;
  @Input() campaign: Campaign;
  @Input() campaignStatus: CampaignStatus;

  peerForm: FormGroup;

  removeGroup() {
    this.createCampaignService.removeGroup(this.group);
  }

  addPeer() {
    this.createCampaignService.addPeer(this.group);
  }
}
