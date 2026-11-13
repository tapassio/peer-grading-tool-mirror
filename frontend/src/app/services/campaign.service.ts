import { Injectable } from '@angular/core';
import {
  Campaign,
  CampaignStatus,
  Criteria,
  Grading,
  Group,
  Language,
  Peer,
  PeerComment,
  User,
} from '../interfaces';

/**
 * campaign service handles everything regarding campaign logic
 */
/**
 * Rounds to the nearest half (commercial rounding, symmetric around 0):
 * 0.24 -> 0, 0.25 -> 0.5, 0.74 -> 0.5, 0.75 -> 1, -0.25 -> -0.5
 * Same function as in the backend (calculations.service.ts).
 */
export function roundToHalf(value: number): number {
  // the small epsilon avoids errors like 0.7499999999 for 0.75
  const rounded = Math.round(Math.abs(value) * 2 + 1e-9) / 2;
  return rounded === 0 ? 0 : Math.sign(value) * rounded;
}

@Injectable({
  providedIn: 'root',
})
export class CampaignService {
  constructor() {}

  ///////////// campaign

  campaignConstructor(
    name: string,
    maxPoints: number,
    language: Language,
    allowCommentsForPeers: boolean = true,
    creationDate: Date = new Date(),
    openingDate?: Date,
    closingDate?: Date,
    groups: Group[] = [],
    criteria: Criteria[] = [],
    id: number = 0
  ): Campaign {
    return <Campaign>{
      campaignId: id,
      name: name,
      language: language,
      allowCommentsForPeers: allowCommentsForPeers,
      maxPoints: maxPoints,
      creationDate: creationDate,
      openingDate: openingDate,
      closingDate: closingDate,
      groups: groups,
      criteria: criteria,
    };
  }

  cleanupCampaignData(campaign: Campaign): Campaign {
    const { creationDate, openingDate, closingDate, ...rest } = campaign;

    return {
      creationDate: new Date(creationDate),
      openingDate: openingDate ? new Date(openingDate) : undefined,
      closingDate: closingDate ? new Date(closingDate) : undefined,
      ...rest,
    };
  }

  // do not localize
  getCampaignStatus(campaign: Campaign): CampaignStatus {
    if (!campaign.openingDate && !campaign.closingDate) {
      return `erstellt`;
    } else if (campaign.openingDate && !campaign.closingDate) {
      return `läuft`;
    } else {
      return `abgeschlossen`;
    }
  }

  gradingsComplete(campaign: Campaign): boolean {
    for (const group of campaign.groups) {
      if (
        group.gradings.length <
        group.peers.length * group.peers.length * campaign.criteria.length
      )
        return false;
    }
    return true;
  }

  countPeers(campaign: Campaign): number {
    let total = 0;
    for (const group of campaign.groups) {
      total += group.peers.length;
    }
    return total;
  }

  countCompletedPeers(campaign: Campaign): number {
    let total = 0;
    for (const group of campaign.groups) {
      for (const peer of group.peers) {
        const gradings = group.gradings.filter(
          (gr: Grading) => gr.fromPeerId == peer.peerId
        );

        if (gradings.length === campaign.criteria.length * group.peers.length)
          total++;
      }
    }

    return total;
  }

  getCompletionPercentage(campaign: Campaign) {
    return (
      Math.round(
        (1000 * this.countCompletedPeers(campaign)) / this.countPeers(campaign)
      ) / 10
    );
  }

  addGroup(campaign: Campaign, ...groups: Group[]): void {
    for (let group of groups) {
      campaign.groups.push(group);
    }
    this.autoNumberGroups(campaign.groups);
  }

  removeGroup(campaign: Campaign, ...groups: Group[]) {
    for (let groupToDelete of groups) {
      const index = campaign.groups.indexOf(groupToDelete);
      if (index != -1) {
        campaign.groups.splice(index, 1);
      }
    }
    this.autoNumberGroups(campaign.groups);
  }

  /**
   * if a group is added or removed, the groups are automatically numbered
   */
  autoNumberGroups(groups: Group[]): void {
    groups.forEach((group, index) => (group.number = index + 1));
  }

  addCriteria(campaign: Campaign, ...criteria: Criteria[]): void {
    for (let crit of criteria) {
      campaign.criteria.push(crit);
    }
  }

  removeCriteria(campaign: Campaign, ...criteria: Criteria[]): void {
    for (let crit of criteria) {
      const index = campaign.criteria.indexOf(crit, 0);
      if (index > -1) {
        campaign.criteria.splice(index, 1);
      }
    }
  }

  getCriteriaByName(campaign: Campaign, name: string): Criteria {
    for (let criteria of campaign.criteria) {
      if (criteria.name === name) {
        return criteria;
      }
    }
    throw 'criteria ' + name + ' does not exist';
  }

  addGrading(group: Group, grading: Grading): void {
    this.addGradingToGroup(group, grading);
  }

  ///////////// group

  groupConstructor(
    number: number = 0,
    peers: Peer[] = [],
    gradings: Grading[] = [],
    completed: boolean = false,
    comments: PeerComment[] = [],
    id: number = 0
  ): Group {
    return <Group>{
      groupId: id,
      number: number,
      peers: peers,
      gradings: gradings,
      completed: completed,
      comments: comments,
    };
  }

  addPeer(group: Group, ...peers: Peer[]): void {
    for (let peer of peers) {
      group.peers.push(peer);
    }
  }

  removePeerFromGroup(group: Group, ...peers: Peer[]): void {
    for (let peer of peers) {
      const index = group.peers.indexOf(peer, 0);
      if (index > -1) {
        group.peers.splice(index, 1);
      }
    }
  }

  addGradingToGroup(group: Group, grading: Grading): void {
    this.updateExistingGrading(group, grading);
  }

  updateExistingGrading(group: Group, newGrading: Grading): void {
    for (let grading of group.gradings) {
      if (
        newGrading.criteria == grading.criteria &&
        newGrading.fromPeer == grading.fromPeer &&
        newGrading.toPeer == grading.toPeer
      ) {
        grading.points = newGrading.points;
        return;
      }
    }
    group.gradings.push(newGrading);
  }

  getCommentByPeer(group: Group, peer: Peer): PeerComment | null {
    for (let comment of group.comments) {
      if (this.peerEquals(comment.fromPeer, peer)) {
        return comment;
      }
    }
    return null;
  }

  getPeerToPeerGradings(group: Group, fromPeer: Peer, toPeer: Peer): Grading[] {
    return group.gradings.filter((grading: Grading) => {
      return (
        this.peerEquals(grading.toPeer, toPeer) &&
        this.peerEquals(grading.fromPeer, fromPeer)
      );
    });
  }

  getGradingPointsByPeersAndCriteria(
    group: Group,
    fromPeer: Peer,
    toPeer: Peer,
    criteria: Criteria
  ) {
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

  getGradingsByPeer(group: Group, fromPeer: Peer): Grading[] {
    const gradings = [];
    for (let toPeer of group.peers) {
      gradings.push(...this.getPeerToPeerGradings(group, fromPeer, toPeer));
    }
    return gradings;
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

  getPeersThirdPartyAverageByCriteria(
    criteria: Criteria,
    group: Group,
    peer: Peer
  ): number {
    let sum = 0;
    let count = 0;
    const filteredGradings = group.gradings.filter(
      (grading) =>
        grading.criteria.criteriaId == criteria.criteriaId &&
        grading.toPeer.peerId == peer.peerId &&
        grading.fromPeer.peerId != peer.peerId
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
        grading.fromPeer.peerId != peer.peerId
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
   * Deviation of a peer = third-party average - group average,
   * rounded to half points (same as the backend, see roundToHalf).
   */
  getPeerReviewDifference(group: Group, peer: Peer): number {
    return roundToHalf(
      this.getPeersThirdPartyAverage(group, peer) - this.getGroupAverage(group)
    );
  }

  getGroupAverage(group: Group): number {
    let sum = 0;
    let count = 0;
    const filteredGradings = group.gradings.filter(
      (grading) => grading.toPeer.peerId != grading.fromPeer.peerId
    );
    for (let grading of filteredGradings) {
      sum += grading.points * grading.criteria.weight;
      count += grading.criteria.weight;
    }
    if (count == 0) return 0;
    return Math.round((sum / count) * 100) / 100;
  }

  ///////////// peer

  peerConstructor(
    firstName: string,
    lastName: string,
    eMail: string,
    matriculationNumber?: string,
    id: number = 0
  ): Peer {
    return <Peer>{
      peerId: id,
      firstName: firstName,
      lastName: lastName,
      matriculationNumber: matriculationNumber,
      email: eMail,
    };
  }

  peerEquals(peer1: Peer, peer2: Peer): boolean {
    return peer1.peerId == peer2.peerId;
  }

  ///////////// criteria

  criteriaConstructor(name: string, weight: number, id: number = 0): Criteria {
    return <Criteria>{
      criteriaId: id,
      name: name,
      weight: weight,
    };
  }

  ///////////// grading

  gradingConstructor(
    criteria: Criteria,
    from: Peer,
    to: Peer,
    points: number,
    timestamp: Date = new Date(),
    gradingId: number = 0
  ): Grading {
    return <Grading>{
      gradingId: gradingId,
      criteria: criteria,
      fromPeer: from,
      toPeer: to,
      points: points,
      timestamp: timestamp,
    };
  }

  ///////////// peerComment

  peerCommentConstructor(
    fromPeer: Peer,
    toUser: User,
    text: string
  ): PeerComment {
    return <PeerComment>{
      fromPeer,
      toUser,
      text,
    };
  }
}
