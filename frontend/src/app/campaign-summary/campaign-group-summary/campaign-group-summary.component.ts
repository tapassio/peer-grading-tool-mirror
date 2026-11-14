import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { Campaign, Group, Peer } from 'src/app/interfaces';
import { CampaignService } from 'src/app/services/campaign.service';
import { MatTooltip } from '@angular/material/tooltip';
import { ToolTipComponent } from '../../tool-tip/tool-tip.component';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { GroupCommentsComponent } from './group-comments/group-comments.component';
/**
 * this is a child component of campaign summary.
 * it handles displaying each group
 */
@Component({
    selector: 'pgt-campaign-group-summary',
    templateUrl: './campaign-group-summary.component.html',
    styleUrls: [
        '../../app.component.css',
        './campaign-group-summary.component.css',
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [MatTooltip, ToolTipComponent, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, GroupCommentsComponent]
})
export class CampaignGroupSummaryComponent {
  campaignService = inject(CampaignService);

  readonly group = input.required<Group>();
  readonly campaign = input.required<Campaign>();
  completed = false;

  /**
   * this method returns the peers that haven't graded yeet
   * @returns a list of peers
   */
  getPeersWithIncompleteGradings(): Peer[] {
    const incompletePeers = [];

    const group = this.group();
    const campaign = this.campaign();
    if (group && campaign) {
      for (const peer of group.peers) {
        const gradingsByPeer = this.campaignService.getGradingsByPeer(
          group,
          peer
        );
        if (
          gradingsByPeer.length <
          campaign.criteria.length * group.peers.length
        )
          incompletePeers.push(peer);
      }
    }
    return incompletePeers;
  }

  getPeerTooltipText(peer: Peer): string {
    let text = '';
    text += `${peer.email}`;
    if (peer.matriculationNumber) {
      text += ` | ${peer.matriculationNumber}`;
    }
    return text;
  }
}
