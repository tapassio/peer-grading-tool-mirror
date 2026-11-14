import { Injectable } from '@nestjs/common';
import {
  Grading,
  Group,
  Peer,
  Criteria,
  Campaign,
  CampaignStatus,
} from '../interfaces';

/**
 * the calculations service contains the logic for pgt objects
 * much like the frontend campaign service
 */
/**
 * Possible rounding steps of the final grade (setting per campaign):
 * 0.5 = half grades (default, Swiss grading), 0.25 = quarter grades,
 * 0.1 = tenths, 1 = whole grades, 0 = no rounding (2 decimals).
 */
export const GRADE_ROUNDING_STEPS = [0.5, 0.25, 0.1, 1, 0];
export const DEFAULT_GRADE_ROUNDING = 0.5;

/**
 * Rounds to the nearest multiple of `step` (commercial rounding, symmetric
 * around 0). Step 0.5: 4.24 -> 4, 4.25 -> 4.5, 4.75 -> 5, -0.25 -> -0.5.
 * Step 0 (or invalid): 2 decimals.
 */
export function roundToStep(value: number, step: number): number {
  const s = step > 0 ? step : 0.01;
  // the small epsilon avoids errors like 4.7499999999 for 4.75
  const rounded = Math.round(Math.abs(value) / s + 1e-9) * s;
  // remove floating point noise (e.g. 0.30000000000000004)
  const clean = Math.round(rounded * 1e6) / 1e6;
  return clean === 0 ? 0 : Math.sign(value) * clean;
}

/** rounds to half points (Swiss half grades) */
export function roundToHalf(value: number): number {
  return roundToStep(value, 0.5);
}

/** rounding step of a campaign; old data without the field: half grades */
export function gradeRoundingOf(campaign?: { gradeRounding?: number | null }): number {
  const step = campaign?.gradeRounding;
  return typeof step === 'number' && GRADE_ROUNDING_STEPS.includes(step)
    ? step
    : DEFAULT_GRADE_ROUNDING;
}

@Injectable()
export class CalculationsService {
  peerEquals(peer1: Peer, peer2: Peer): boolean {
    return peer1.peerId == peer2.peerId;
  }

  getPeerToPeerGradings(group: Group, toPeer: Peer, fromPeer: Peer): Grading[] {
    return group.gradings.filter((grading: Grading) => {
      return (
        this.peerEquals(grading.toPeer, toPeer) &&
        this.peerEquals(grading.fromPeer, fromPeer)
      );
    });
  }

  getCampaignStatus(campaign: Campaign): CampaignStatus {
    if (!campaign.openingDate && !campaign.closingDate) {
      return `erstellt`;
    } else if (campaign.openingDate && !campaign.closingDate) {
      return `läuft`;
    } else {
      return `abgeschlossen`;
    }
  }

  getPeersThirdPartyAverageByCriteria(
    criteria: Criteria,
    group: Group,
    peer: Peer,
  ): number {
    let sum = 0;
    let count = 0;
    const filteredGradings = group.gradings.filter(
      (grading) =>
        grading.criteria.criteriaId == criteria.criteriaId &&
        grading.toPeer.peerId == peer.peerId &&
        grading.fromPeer.peerId != peer.peerId,
    );
    for (let grading of filteredGradings) {
      sum += grading.points;
      count++;
    }
    if (count == 0) {
      return 0;
    }
    return Math.round((sum / count) * 100) / 100;
  }

  getPeersThirdPartyAverage(group: Group, peer: Peer): number {
    let sum = 0;
    let count = 0;
    const filteredGradings = group.gradings.filter(
      (grading) =>
        grading.toPeer.peerId == peer.peerId &&
        grading.fromPeer.peerId != peer.peerId,
    );
    for (let grading of filteredGradings) {
      sum += grading.points * grading.criteria.weight;
      count += grading.criteria.weight;
    }
    if (count == 0) {
      return 0;
    }
    return Math.round((sum / count) * 100) / 100;
  }

  /**
   * Deviation of a peer = third-party average - group average, rounded with
   * the rounding step of the campaign (default: half grades, 0.25 -> 0.5).
   * Calculated from the unrounded averages, rounded only at the end.
   */
  getPeerReviewDifference(
    group: Group,
    peer: Peer,
    step: number = DEFAULT_GRADE_ROUNDING,
  ): number {
    return roundToStep(
      this.getPeersThirdPartyAverage(group, peer) - this.getGroupAverage(group),
      step,
    );
  }

  /**
   * Final grade of a peer = weighted average of the gradings by the others,
   * rounded with the rounding step of the campaign (default: half grades).
   */
  getPeersGrade(
    campaign: { gradeRounding?: number | null },
    group: Group,
    peer: Peer,
  ): number {
    return roundToStep(
      this.getPeersThirdPartyAverage(group, peer),
      gradeRoundingOf(campaign),
    );
  }

  /**
   * gets the average of all gradings except the ones peers gave themselves
   * @param group
   * @returns
   */
  getGroupAverage(group: Group): number {
    let sum = 0;
    let count = 0;
    const filteredGradings = group.gradings.filter(
      (grading) => grading.toPeer.peerId != grading.fromPeer.peerId,
    );
    for (let grading of filteredGradings) {
      sum += grading.points * grading.criteria.weight;
      count += grading.criteria.weight;
    }
    if (count == 0) return 0;
    return Math.round((sum / count) * 100) / 100;
  }

  getGradingPointsByPeersAndCriteria(
    group: Group,
    fromPeer: Peer,
    toPeer: Peer,
    criteria: Criteria,
  ): number {
    const grading = group.gradings.find((grading) => {
      return (
        grading.fromPeer.peerId == fromPeer.peerId &&
        grading.toPeer.peerId == toPeer.peerId &&
        grading.criteria.criteriaId == criteria.criteriaId
      );
    });
    if (!grading) return 0;
    return grading.points;
  }

  getPeersSelfGradingPointsByCriteria(
    criteria: Criteria,
    group: Group,
    peer: Peer,
  ): number {
    return this.getGradingPointsByPeersAndCriteria(group, peer, peer, criteria);
  }

  getPeerToPeerAverage(group: Group, fromPeer: Peer, toPeer: Peer): number {
    const gradings = this.getPeerToPeerGradings(group, fromPeer, toPeer);
    if (gradings.length == 0) {
      return 0;
    } else {
      let sum = 0;
      let count = 0;
      for (let grading of gradings) {
        sum += grading.points * grading.criteria.weight;
        count += grading.criteria.weight;
      }
      return Math.round((sum / count) * 100) / 100;
    }
  }

  getPeersSelfAverage(group: Group, peer: Peer): number {
    return this.getPeerToPeerAverage(group, peer, peer);
  }
}
