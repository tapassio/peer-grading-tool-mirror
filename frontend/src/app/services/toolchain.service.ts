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
/** role key in the manifest and in `assignments` of the Tool Details Document */
export const PGT_RESULT_ROLE = 'peerGradingResult';

export interface PublishTarget {
  structureId: string;
  type: number;
  subType: number;
}

/**
 * Normalises a tool URL for comparison: no trailing slash, no language
 * prefix (/de, /en), no query/hash, lower-case host.
 * "https://Host/tc/PeerGrading/de/" -> "https://host/tc/PeerGrading"
 */
export function normalizeToolUrl(url: string | undefined | null): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const path = u.pathname
      .replace(/\/+$/, '')
      .replace(/\/(de|en)$/i, '');
    return `${u.protocol}//${u.host.toLowerCase()}${path}`;
  } catch {
    return '';
  }
}

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

  /** random number 0..1 (crypto); replaceable in tests */
  random: () => number = () =>
    crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

  /** Fisher-Yates shuffle with crypto random numbers */
  private shuffled<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Builds the anonymised result payload. Peers are replaced by a per-group
   * label ("Peer 1", "Peer 2", ...), never by name or e-mail.
   *
   * The order is shuffled on every publication: otherwise "Peer 1" would be
   * the first person of the class list (usually alphabetical) and anybody
   * who knows the list could assign the results to the students.
   */
  buildResult(campaign: Campaign): PeerGradingResult {
    const results: PeerGradingResultRow[] = [];

    for (const group of campaign.groups) {
      this.shuffled(group.peers).forEach((peer, index) => {
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

    const target = await this.resolveTarget(client);
    const result = this.buildResult(campaign);

    // `createDocument` is typed with the full entry (including the
    // server-assigned `_id`/`owner`), but the API only expects the creation
    // payload. The reference Toolchain tools call it the same way.
    const payload: I_DocumentCreation = {
      // type/subType of the assigned structure, not a fixed value: the Tool
      // Manager gives new structures the next free type (not always 100)
      type: target.type,
      subType: target.subType,
      title: `${PGT_TOOL_NAME} — ${campaign.name}`,
      description:
        'Aggregated, anonymised peer grading results. Visible to administrators only.',
      shareWithGroup: false,
      shareWithDepartment: false,
      // Private: owner + DocPouch administrators only.
      public: false,
      content: {
        structureID: target.structureId,
        structuredData: result,
      },
    };

    const document = await client.createDocument(
      payload as unknown as I_DocumentEntry
    );

    return document._id;
  }

  /**
   * Finds the structure (and its type/subType) for the published results:
   *
   * 1. PGT_RESULT_STRUCTURE_ID from the backend configuration (recommended
   *    for production: cannot be redirected by other DocPouch users)
   * 2. the Tool Details Document whose `url` is this installation, role
   *    `peerGradingResult` (the tool name can be renamed in the Tool Manager,
   *    the url not)
   * 3. development only: a structure named "Peer Grading Result"
   */
  async resolveTarget(client: DocPouchClient): Promise<PublishTarget> {
    const config = this.authService.getConfig();
    const structures = await client.getStructures();

    const fromStructure = (id: string): PublishTarget | null => {
      const s = structures.find((candidate) => candidate._id === id);
      return s
        ? {
            structureId: s._id as string,
            type: s.type ?? PGT_RESULT_TYPE,
            subType: s.subType ?? PGT_RESULT_SUBTYPE,
          }
        : null;
    };

    // 1. fixed configuration
    if (config.resultStructureId) {
      const target = fromStructure(config.resultStructureId);
      if (!target) throw new Error('PGT_RESULT_STRUCTURE_NOT_FOUND');
      return target;
    }

    // 2. Tool Details Document of this installation
    const ownUrl = normalizeToolUrl(config.publicUrl || document.baseURI);
    const toolDocuments = await client.fetchDocuments({ type: 0, subType: 0 });
    const matches = toolDocuments.filter(
      (d) =>
        normalizeToolUrl(d.content?.url) === ownUrl &&
        d.content?.assignments?.[PGT_RESULT_ROLE]?.structureId
    );
    if (matches.length > 1) {
      // several documents claim to be this tool: do not guess
      throw new Error('PGT_TOOL_DOCUMENT_AMBIGUOUS');
    }
    if (matches.length === 1) {
      const assignment = matches[0].content.assignments[PGT_RESULT_ROLE];
      const structure = fromStructure(assignment.structureId);
      return {
        structureId: assignment.structureId,
        // the assignment is what the operator chose in the Tool Manager
        type: assignment.type ?? structure?.type ?? PGT_RESULT_TYPE,
        subType: assignment.subType ?? structure?.subType ?? PGT_RESULT_SUBTYPE,
      };
    }

    // 3. development fallback
    if (config.allowStructureNameFallback) {
      const s = structures.find((c) => c.name === PGT_RESULT_STRUCTURE_NAME);
      if (s?._id) return fromStructure(s._id) as PublishTarget;
    }

    throw new Error('PGT_RESULT_STRUCTURE_MISSING');
  }
}
