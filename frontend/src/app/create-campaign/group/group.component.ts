import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Group, Campaign, CampaignStatus, Peer } from 'src/app/interfaces';
import { CreateCampaignService } from '../create-campaign.service';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PeerComponent } from './peer/peer.component';

@Component({
    selector: 'pgt-group',
    templateUrl: './group.component.html',
    styleUrls: ['../../app.component.css', './group.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatButton, MatIcon, PeerComponent]
})
export class GroupComponent {
  private createCampaignService = inject(CreateCampaignService);

  readonly group = input.required<Group>();
  readonly campaign = input.required<Campaign>();
  readonly campaignStatus = input.required<CampaignStatus>();

  peerForm: FormGroup;

  removeGroup() {
    this.createCampaignService.removeGroup(this.group());
  }

  /**
   * CreateCampaignService changes groups in place (adding peers, CSV
   * import). Reading its signal here makes this OnPush component redraw on
   * every change.
   */
  peers(): Peer[] {
    this.createCampaignService.campaign();
    return this.group().peers;
  }

  addPeer() {
    this.createCampaignService.addPeer(this.group());
  }
}
