import { Injectable } from '@angular/core';
import DocPouchClient, {
  I_DocumentCreation,
  I_DocumentEntry,
} from 'docpouch-client';
import { Campaign } from '../interfaces';
import { AuthService } from './auth.service';
import { CampaignService } from './campaign.service';

/** DocPouch type/subType pair of the peer grading result structure. */
export const PGT_RESULT_TYPE = 100;
export const PGT_RESULT_SUBTYPE = 0;
export const PGT_RESULT_STRUCTURE_NAME = 'Peer Grading Result';
export const PGT_TOOL_NAME = 'Peer Grading';

export interface PeerGradingResultRow {
  peerLabel: string;
  groupNumber: number;
  peerCount: number;
  criteriaNames: string[];
  criteriaScores: number[];
  selfScore: number;
  weightedScore: number;
}

export interface PeerGradingResult {
  campaignName: string;
  campaignId: number;
  publishedAt: string;
  results: PeerGradingResultRow[];
}

/**
 * Publishes aggregated, anonymised peer grading results to DocPouch.
 *
 * The document is created as private: only the owner (the signed-in admin)
 * and DocPouch administrators can read it. No names, e-mails or comments are
 * published.
 */
@Injectable({
  providedIn: 'root',
})
export class ToolchainService {
  constructor(
    private authService: AuthService,
    private campaignService: CampaignService
  ) {}

  canPublish(): boolean {
    return this.authService.isOidcMode();
  }

  /**
   * Builds the anonymised result payload. Peers are replaced by a stable
   * per-group label ("Peer 1", "Peer 2", ...), never by name or e-mail.
   */
  buildResult(campaign: Campaign): PeerGradingResult {
    const results: PeerGradingResultRow[] = [];

    for (const group of campaign.groups) {
      group.peers.forEach((peer, index) => {
        results.push({
          peerLabel: `Peer ${index + 1}`,
          groupNumber: group.number,
          peerCount: group.peers.length,
          criteriaNames: campaign.criteria.map((criteria) => criteria.name),
          criteriaScores: campaign.criteria.map((criteria) =>
            this.campaignService.getPeersThirdPartyAverageByCriteria(
              criteria,
              group,
              peer
            )
          ),
          selfScore: this.campaignService.getPeersSelfAverage(group, peer),
          weightedScore: this.campaignService.getPeersThirdPartyAverage(
            group,
            peer
          ),
        });
      });
    }

    return {
      campaignName: campaign.name,
      campaignId: campaign.campaignId,
      publishedAt: new Date().toISOString(),
      results,
    };
  }

  /**
   * Creates the private DocPouch document and returns its id.
   */
  async publishCampaign(campaign: Campaign): Promise<string> {
    const client = this.authService.getDocPouchClient();
    if (!client) {
      throw new Error('DOCPOUCH_NOT_AVAILABLE');
    }

    // Refresh the DocPouch token if it is about to expire.
    await client.ensureValidOidcToken();

    const structureId = await this.resolveStructureId(client);
    const result = this.buildResult(campaign);

    // `createDocument` is typed with the full entry (including the
    // server-assigned `_id`/`owner`), but the API only expects the creation
    // payload. The reference Toolchain tools call it the same way.
    const payload: I_DocumentCreation = {
      type: PGT_RESULT_TYPE,
      subType: PGT_RESULT_SUBTYPE,
      title: `${PGT_TOOL_NAME} — ${campaign.name}`,
      description:
        'Aggregated, anonymised peer grading results. Visible to administrators only.',
      shareWithGroup: false,
      shareWithDepartment: false,
      // Private: owner + DocPouch administrators only.
      public: false,
      content: {
        structureID: structureId,
        structuredData: result,
      },
    };

    const document = await client.createDocument(
      payload as unknown as I_DocumentEntry
    );

    return document._id;
  }

  private async resolveStructureId(client: DocPouchClient): Promise<string> {
    // Prefer the structure linked in the Tool Details Document, so the
    // dashboard and the tool always agree on the structure.
    try {
      const toolDocuments = await client.fetchDocuments({ type: 0, subType: 0 });
      const toolDocument = toolDocuments.find(
        (document) =>
          document.content?.name === PGT_TOOL_NAME &&
          document.content?.assignments?.peerGradingResult?.structureId
      );
      if (toolDocument) {
        return toolDocument.content.assignments.peerGradingResult.structureId;
      }
    } catch {
      // Fall through to the direct structure lookup.
    }

    const structures = await client.getStructures();
    const structure =
      structures.find(
        (candidate) => candidate.name === PGT_RESULT_STRUCTURE_NAME
      ) ||
      structures.find(
        (candidate) =>
          candidate.type === PGT_RESULT_TYPE &&
          candidate.subType === PGT_RESULT_SUBTYPE
      );

    if (!structure?._id) {
      throw new Error('PGT_RESULT_STRUCTURE_MISSING');
    }

    return structure._id;
  }
}
