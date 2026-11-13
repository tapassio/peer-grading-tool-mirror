import {
  RawCampaign,
  RawGrading,
  StatisticsService,
  median,
  standardDeviation,
} from './statistics.service';

/*
 * Example group with 3 students (A=1, B=2, C=3), one criterion (weight 1),
 * scale 1-8.
 *
 * Gradings (from -> to: points):
 *   A: A 8, B 4, C 4      (A rates himself much higher)
 *   B: A 4, B 5, C 5
 *   C: A 4, B 5, C 5
 *
 * Third-party averages: A = (4+4)/2 = 4, B = (4+5)/2 = 4.5, C = 4.5
 * Group average (third-party only): (4+4+4+5+4+5)/6 = 4.33
 * Deviation: A = -0.33, B = +0.17, C = +0.17
 *   rounded to half points: A = -0.5, B = 0, C = 0
 * Self vs. others: A 8 - 4 = +4  -> finding "selfHigher"
 * A gives B and C the same points (4) -> finding "sameForAll"
 */
function g(from: number, to: number, points: number): RawGrading {
  return { fromPeerId: from, toPeerId: to, criteriaId: 1, points };
}

const peer = (peerId: number, firstName: string) => ({
  peerId,
  peer: { peerId, firstName, lastName: 'Test' },
});

const campaign: RawCampaign = {
  campaignId: 1,
  name: 'Demo',
  maxPoints: 8,
  openingDate: '2026-10-01',
  closingDate: null,
  criteria: [{ criteriaId: 1, name: 'Quality', weight: 1 }],
  groups: [
    {
      groupId: 10,
      number: 1,
      peers: [peer(1, 'A'), peer(2, 'B'), peer(3, 'C')],
      gradings: [
        g(1, 1, 8), g(1, 2, 4), g(1, 3, 4),
        g(2, 1, 4), g(2, 2, 5), g(2, 3, 5),
        g(3, 1, 4), g(3, 2, 5), g(3, 3, 5),
      ],
    },
  ],
};

describe('StatisticsService', () => {
  const service = new StatisticsService();

  it('helpers', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(standardDeviation([5])).toBe(0);
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.14, 2);
  });

  it('absolute numbers and response rate', () => {
    const { kpis } = service.calculate([campaign]);
    expect(kpis.campaigns).toBe(1);
    expect(kpis.runningCampaigns).toBe(1);
    expect(kpis.students).toBe(3);
    expect(kpis.groups).toBe(1);
    expect(kpis.completedStudents).toBe(3);
    expect(kpis.responseRate).toBe(100);
    expect(kpis.openGradings).toBe(0);
    expect(kpis.averages).toEqual([{ maxPoints: 8, average: 4.33 }]);
    // B and C (+0.17) are rounded to 0 -> no deviation
    expect(kpis.positiveDeviations).toBe(0);
    expect(kpis.negativeDeviations).toBe(1); // A
  });

  it('averages per student (same definitions as the campaign overview)', () => {
    const { peers } = service.calculate([campaign]);
    const a = peers.find((p) => p.peerId === 1)!;
    expect(a.selfAverage).toBe(8);
    expect(a.thirdPartyAverage).toBe(4);
    expect(a.groupAverage).toBe(4.33);
    expect(a.deviation).toBe(-0.5); // -0.33 rounded to half points
  });

  it('findings', () => {
    const { findings } = service.calculate([campaign]);
    const types = findings.map((f) => `${f.student}:${f.type}`);
    expect(types).toContain('A Test:selfHigher');
    expect(types).toContain('A Test:sameForAll');
    expect(findings[0].type).toBe('selfHigher'); // strongest first (4 points)
  });

  it('distribution and criteria table use third-party gradings only', () => {
    const { distributions, criteria } = service.calculate([campaign]);
    expect(distributions).toHaveLength(1);
    expect(distributions[0].total).toBe(6);
    // only whole points used -> no half steps shown
    expect(distributions[0].steps.map((s) => s.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(distributions[0].steps[3].count).toBe(4); // four times 4 points
    expect(distributions[0].steps[4].count).toBe(2); // two times 5 points
    expect(criteria[0]).toEqual(
      expect.objectContaining({ name: 'Quality', n: 6, median: 4, min: 4, max: 5 })
    );
  });

  it('averages are calculated per scale, not mixed', () => {
    const swiss: RawCampaign = {
      ...campaign,
      campaignId: 2,
      maxPoints: 6,
      groups: [
        {
          ...campaign.groups[0],
          gradings: campaign.groups[0].gradings.map((x) => ({
            ...x,
            points: Math.min(x.points, 6),
          })),
        },
      ],
    };
    const { kpis } = service.calculate([campaign, swiss]);
    expect(kpis.averages.map((a) => a.maxPoints)).toEqual([6, 8]);
    expect(kpis.averages[1].average).toBe(4.33);
  });

  it('histogram of the deviations (one value per student)', () => {
    const d = service.calculate([campaign]).deviationDistribution!;
    expect(d.scales).toEqual([8]);
    expect(d.total).toBe(3);
    // range at least -1 .. +1 in half steps
    expect(d.steps.map((s) => s.value)).toEqual([-1, -0.5, 0, 0.5, 1]);
    // A: -0.5, B and C: 0
    expect(d.steps.find((s) => s.value === -0.5)!.count).toBe(1);
    expect(d.steps.find((s) => s.value === 0)!.count).toBe(2);
  });

  it('half grades: histogram with half steps', () => {
    const halves: RawCampaign = {
      ...campaign,
      maxPoints: 6,
      groups: [
        {
          ...campaign.groups[0],
          gradings: [g(1, 2, 4.5), g(2, 1, 5.5), g(3, 1, 4), g(1, 3, 6)],
        },
      ],
    };
    const { distributions } = service.calculate([halves]);
    const steps = distributions[0].steps;
    expect(steps.map((s) => s.value)).toEqual([
      1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6,
    ]);
    expect(steps.find((s) => s.value === 4.5)!.count).toBe(1);
    expect(steps.find((s) => s.value === 5.5)!.count).toBe(1);
  });

  it('missing gradings', () => {
    const incomplete: RawCampaign = {
      ...campaign,
      groups: [
        {
          ...campaign.groups[0],
          // C has not graded yet
          gradings: campaign.groups[0].gradings.filter((x) => x.fromPeerId !== 3),
        },
      ],
    };
    const { kpis, responses } = service.calculate([incomplete], undefined, true);
    expect(kpis.completedStudents).toBe(2);
    expect(kpis.openGradings).toBe(3);
    expect(responses[0].missing).toEqual(['C Test']);
    expect(responses[0].rate).toBe(66.67);
  });
});
