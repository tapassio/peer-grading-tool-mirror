import { Injectable } from '@angular/core';
import { gradeRoundingOf, roundToStep } from './campaign.service';

/*
 * Statistics for the dashboard ("Statistik" page).
 *
 * Works on the data of GET /campaign/user. There the gradings only contain
 * ids (fromPeerId, toPeerId, criteriaId) and group.peers contains the
 * connection objects ({ peerId, peer: {...} }). Everything is calculated in
 * the browser; the backend is not changed.
 *
 * Definitions (same as in the rest of the tool, see CampaignService):
 * - averages are weighted with the criteria weights
 * - "third-party average" = average of the gradings a peer received from the
 *   OTHER members of the group (self-grading excluded)
 * - "group average" = average of all third-party gradings in the group
 * - "deviation" = third-party average - group average
 * - all deviations / differences are rounded with the rounding step of the
 *   campaign (setting "Rundung der Note", default half grades); points can
 *   be whole or half (4.5)
 */

// ---- input types (shape of the API response) ----

export interface RawCriteria {
  criteriaId: number;
  name: string;
  weight: number;
}

export interface RawGrading {
  fromPeerId: number;
  toPeerId: number;
  criteriaId: number;
  points: number;
}

export interface RawPeer {
  peerId: number;
  firstName: string;
  lastName: string;
}

export interface RawGroup {
  groupId: number;
  number: number;
  peers: { peerId: number; peer?: RawPeer }[];
  gradings: RawGrading[];
}

export interface RawCampaign {
  campaignId: number;
  name: string;
  maxPoints: number;
  /** rounding step of the final grade (default 0.5) */
  gradeRounding?: number | null;
  openingDate?: Date | string | null;
  closingDate?: Date | string | null;
  criteria: RawCriteria[];
  groups: RawGroup[];
}

// ---- output types ----

export interface Thresholds {
  /** min. difference in points for "self image differs" and "outlier" */
  deviation: number;
  /** min. difference between the most and least generous rater */
  spread: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { deviation: 1.5, spread: 3 };

export interface Kpis {
  campaigns: number;
  runningCampaigns: number;
  students: number;
  groups: number;
  completedStudents: number;
  responseRate: number; // 0..100
  openGradings: number;
  /**
   * weighted average of the third-party gradings, one entry per scale
   * (campaigns can have different max. points, they are not mixed)
   */
  averages: { maxPoints: number; average: number }[];
  positiveDeviations: number;
  negativeDeviations: number;
}

export interface ResponseRow {
  label: string;
  completed: number;
  total: number;
  rate: number; // 0..100
  missing: string[]; // names of students who have not finished
}

export interface Distribution {
  maxPoints: number;
  /** one entry per possible value: 1, 1.5, 2, ... (halves only if used) */
  steps: { value: number; count: number }[];
  total: number;
}

/**
 * Histogram of the deviations (third-party average - group average,
 * rounded to half points): one count per student, symmetric around 0.
 * All selected campaigns together; `scales` lists the max. points involved.
 */
export interface DeviationDistribution {
  scales: number[];
  steps: { value: number; count: number }[];
  total: number;
}

export interface CriteriaStats {
  name: string;
  maxPoints: number;
  n: number;
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
}

export type FindingType =
  | 'selfHigher'
  | 'selfLower'
  | 'aboveGroup'
  | 'belowGroup'
  | 'sameForAll'
  | 'raterSpread';

export interface Finding {
  type: FindingType;
  campaign: string;
  group: number;
  student: string;
  /** the value that triggered the finding (points) */
  value: number;
}

export interface PeerResult {
  campaign: string;
  maxPoints: number;
  group: number;
  peerId: number;
  name: string;
  selfAverage: number | null;
  thirdPartyAverage: number | null;
  groupAverage: number | null;
  deviation: number | null;
}

export interface Statistics {
  kpis: Kpis;
  responses: ResponseRow[];
  distributions: Distribution[];
  deviationDistribution: DeviationDistribution | null;
  criteria: CriteriaStats[];
  findings: Finding[];
  peers: PeerResult[];
}

// ---- helpers ----

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** sample standard deviation (n - 1); 0 for less than 2 values */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function weightedAverage(
  gradings: RawGrading[],
  weights: Map<number, number>
): number | null {
  let sum = 0;
  let count = 0;
  for (const g of gradings) {
    const w = weights.get(g.criteriaId) ?? 1;
    sum += g.points * w;
    count += w;
  }
  return count === 0 ? null : round2(sum / count);
}

export function campaignStatus(
  c: RawCampaign
): 'created' | 'running' | 'closed' {
  if (!c.openingDate && !c.closingDate) return 'created';
  if (c.openingDate && !c.closingDate) return 'running';
  return 'closed';
}

function peerName(p: { peerId: number; peer?: RawPeer }): string {
  return p.peer ? `${p.peer.firstName} ${p.peer.lastName}` : `#${p.peerId}`;
}

// ---- main calculation ----

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  calculate(
    campaigns: RawCampaign[],
    thresholds: Thresholds = DEFAULT_THRESHOLDS,
    perGroup = false
  ): Statistics {
    const responses: ResponseRow[] = [];
    const findings: Finding[] = [];
    const peers: PeerResult[] = [];
    // per scale: counts per half step (index 0 = 1 point, 1 = 1.5, ...)
    const histograms = new Map<number, number[]>();
    const criteriaPoints = new Map<string, { maxPoints: number; points: number[] }>();
    const thirdPartyByScale = new Map<number, { sum: number; weight: number }>();

    let students = 0;
    let groups = 0;
    let completedStudents = 0;
    let openGradings = 0;

    for (const c of campaigns) {
      const weights = new Map(c.criteria.map((cr) => [cr.criteriaId, cr.weight]));
      const step = gradeRoundingOf(c);
      const criteriaNames = new Map(c.criteria.map((cr) => [cr.criteriaId, cr.name]));
      let campaignCompleted = 0;
      let campaignStudents = 0;
      const campaignMissing: string[] = [];

      for (const group of c.groups) {
        groups++;
        const n = group.peers.length;
        students += n;
        campaignStudents += n;
        const expectedPerPeer = n * c.criteria.length;
        openGradings += Math.max(
          0,
          n * expectedPerPeer - group.gradings.length
        );

        const thirdParty = group.gradings.filter((g) => g.fromPeerId !== g.toPeerId);
        const groupAverage = weightedAverage(thirdParty, weights);
        const groupMissing: string[] = [];
        let groupCompleted = 0;

        for (const p of group.peers) {
          const name = peerName(p);
          const given = group.gradings.filter((g) => g.fromPeerId === p.peerId);
          if (expectedPerPeer > 0 && given.length >= expectedPerPeer) {
            groupCompleted++;
          } else {
            groupMissing.push(name);
          }

          const self = given.filter((g) => g.toPeerId === p.peerId);
          const received = thirdParty.filter((g) => g.toPeerId === p.peerId);
          const selfAverage = weightedAverage(self, weights);
          const thirdPartyAverage = weightedAverage(received, weights);
          const deviation =
            thirdPartyAverage !== null && groupAverage !== null
              ? roundToStep(thirdPartyAverage - groupAverage, step)
              : null;

          peers.push({
            campaign: c.name,
            maxPoints: c.maxPoints,
            group: group.number,
            peerId: p.peerId,
            name,
            selfAverage,
            thirdPartyAverage,
            groupAverage,
            deviation,
          });

          const base = { campaign: c.name, group: group.number, student: name };

          // self image vs. image of the others
          if (selfAverage !== null && thirdPartyAverage !== null) {
            const diff = roundToStep(selfAverage - thirdPartyAverage, step);
            if (diff >= thresholds.deviation)
              findings.push({ ...base, type: 'selfHigher', value: diff });
            if (diff <= -thresholds.deviation)
              findings.push({ ...base, type: 'selfLower', value: diff });
          }

          // clearly above / below the group
          if (deviation !== null) {
            if (deviation >= thresholds.deviation)
              findings.push({ ...base, type: 'aboveGroup', value: deviation });
            if (deviation <= -thresholds.deviation)
              findings.push({ ...base, type: 'belowGroup', value: deviation });
          }

          // gives everybody exactly the same points
          const givenToOthers = given.filter((g) => g.toPeerId !== p.peerId);
          const others = new Set(givenToOthers.map((g) => g.toPeerId));
          if (
            others.size >= 2 &&
            new Set(givenToOthers.map((g) => g.points)).size === 1
          ) {
            findings.push({
              ...base,
              type: 'sameForAll',
              value: givenToOthers[0].points,
            });
          }

          // the raters disagree strongly about this student
          const raterAverages: number[] = [];
          for (const rater of new Set(received.map((g) => g.fromPeerId))) {
            const avg = weightedAverage(
              received.filter((g) => g.fromPeerId === rater),
              weights
            );
            if (avg !== null) raterAverages.push(avg);
          }
          if (raterAverages.length >= 2) {
            const spread = roundToStep(
              Math.max(...raterAverages) - Math.min(...raterAverages),
              step
            );
            if (spread >= thresholds.spread)
              findings.push({ ...base, type: 'raterSpread', value: spread });
          }
        }

        // distribution and per-criteria values (third-party gradings only)
        for (const g of thirdParty) {
          const hist =
            histograms.get(c.maxPoints) ?? new Array(2 * c.maxPoints - 1).fill(0);
          const index = Math.round((g.points - 1) * 2);
          if (index >= 0 && index < hist.length) hist[index]++;
          histograms.set(c.maxPoints, hist);

          const crName = criteriaNames.get(g.criteriaId) ?? '?';
          const key = `${crName}|${c.maxPoints}`;
          const entry = criteriaPoints.get(key) ?? { maxPoints: c.maxPoints, points: [] };
          entry.points.push(g.points);
          criteriaPoints.set(key, entry);

          const w = weights.get(g.criteriaId) ?? 1;
          const scale = thirdPartyByScale.get(c.maxPoints) ?? { sum: 0, weight: 0 };
          scale.sum += g.points * w;
          scale.weight += w;
          thirdPartyByScale.set(c.maxPoints, scale);
        }

        completedStudents += groupCompleted;
        campaignCompleted += groupCompleted;
        campaignMissing.push(...groupMissing);

        if (perGroup) {
          responses.push({
            label: `${group.number}`,
            completed: groupCompleted,
            total: n,
            rate: n ? round2((100 * groupCompleted) / n) : 0,
            missing: groupMissing,
          });
        }
      }

      if (!perGroup) {
        responses.push({
          label: c.name,
          completed: campaignCompleted,
          total: campaignStudents,
          rate: campaignStudents ? round2((100 * campaignCompleted) / campaignStudents) : 0,
          missing: campaignMissing,
        });
      }
    }

    const kpis: Kpis = {
      campaigns: campaigns.length,
      runningCampaigns: campaigns.filter((c) => campaignStatus(c) === 'running').length,
      students,
      groups,
      completedStudents,
      responseRate: students ? round2((100 * completedStudents) / students) : 0,
      openGradings,
      averages: [...thirdPartyByScale.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([maxPoints, { sum, weight }]) => ({
          maxPoints,
          average: round2(sum / weight),
        })),
      positiveDeviations: peers.filter((p) => (p.deviation ?? 0) > 0).length,
      negativeDeviations: peers.filter((p) => (p.deviation ?? 0) < 0).length,
    };

    const distributions: Distribution[] = [...histograms.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([maxPoints, counts]) => {
        // show half steps only if half points were given on this scale
        const usesHalves = counts.some((n, i) => i % 2 === 1 && n > 0);
        return {
          maxPoints,
          steps: counts
            .map((count, i) => ({ value: 1 + i / 2, count }))
            .filter((_, i) => usesHalves || i % 2 === 0),
          total: counts.reduce((a, b) => a + b, 0),
        };
      });

    // one histogram for all selected campaigns; symmetric, at least -1 .. +1.
    // Bars in half steps; if a campaign rounds finer (0.25, 0.1, none),
    // in quarter steps. The values are put into the nearest bar.
    const withDeviation = peers.filter((p) => p.deviation !== null);
    let deviationDistribution: DeviationDistribution | null = null;
    if (withDeviation.length > 0) {
      const binStep = campaigns.every((c) => gradeRoundingOf(c) >= 0.5) ? 0.5 : 0.25;
      const values = withDeviation.map((p) => roundToStep(p.deviation as number, binStep));
      const range = Math.max(1, ...values.map((v) => Math.abs(v)));
      const steps: { value: number; count: number }[] = [];
      for (let v = -range; v <= range + 1e-9; v += binStep) {
        const value = roundToStep(v, binStep); // no floating point noise, no -0
        steps.push({ value, count: values.filter((d) => d === value).length });
      }
      deviationDistribution = {
        scales: [...new Set(withDeviation.map((p) => p.maxPoints))].sort(
          (a, b) => a - b
        ),
        steps,
        total: values.length,
      };
    }

    const criteria: CriteriaStats[] = [...criteriaPoints.entries()]
      .map(([key, { maxPoints, points }]) => ({
        name: key.split('|')[0],
        maxPoints,
        n: points.length,
        mean: round2(mean(points)),
        median: median(points),
        sd: round2(standardDeviation(points)),
        min: Math.min(...points),
        max: Math.max(...points),
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.maxPoints - b.maxPoints);

    // grouped by type (most relevant first), strongest finding first
    const order: FindingType[] = [
      'selfHigher',
      'selfLower',
      'belowGroup',
      'aboveGroup',
      'raterSpread',
      'sameForAll',
    ];
    findings.sort(
      (a, b) =>
        order.indexOf(a.type) - order.indexOf(b.type) ||
        Math.abs(b.value) - Math.abs(a.value)
    );

    return {
      kpis,
      responses,
      distributions,
      deviationDistribution,
      criteria,
      findings,
      peers,
    };
  }
}
