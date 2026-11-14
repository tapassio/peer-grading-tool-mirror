import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Campaign, Group, Peer } from 'src/app/interfaces';
import { CampaignService } from 'src/app/services/campaign.service';
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
    standalone: false
})
export class CampaignGroupSummaryComponent {
  @Input() group?: Group;
  @Input() campaign?: Campaign;
  completed = false;

  constructor(public campaignService: CampaignService) {}

  /**
   * this method returns the peers that haven't graded yeet
   * @returns a list of peers
   */
  getPeersWithIncompleteGradings(): Peer[] {
    const incompletePeers = [];

    if (this.group && this.campaign) {
      for (const peer of this.group.peers) {
        const gradingsByPeer = this.campaignService.getGradingsByPeer(
          this.group,
          peer
        );
        if (
          gradingsByPeer.length <
          this.campaign.criteria.length * this.group.peers.length
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
