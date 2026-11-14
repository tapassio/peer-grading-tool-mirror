import {
  CalculationsService,
  gradeRoundingOf,
  roundToHalf,
  roundToStep,
} from './calculations.service';
import {
  createCampaignSchema,
  createGradingSchema,
} from '../validators/joi-objects';

describe('half grades', () => {
  it.each([
    [0.24, 0],
    [0.25, 0.5],
    [0.74, 0.5],
    [0.75, 1],
    [-0.25, -0.5],
    [-0.33, -0.5],
    [1.26, 1.5],
  ])('roundToHalf(%p) = %p', (input, expected) => {
    expect(roundToHalf(input)).toBe(expected);
  });

  const grading = (points: number) => ({
    criteria: { criteriaId: 1, name: 'Quality', weight: 1 },
    fromPeer: { peerId: 1, firstName: 'A', lastName: 'B', email: 'a@b.ch' },
    toPeer: { peerId: 2, firstName: 'C', lastName: 'D', email: 'c@d.ch' },
    points,
  });
  const schema = createGradingSchema(6);

  it.each([1, 4, 4.5, 5.5, 6])('accepts %p points', (points) => {
    expect(schema.validate(grading(points)).error).toBeUndefined();
  });

  it.each([0.5, 4.3, 4.25, 6.5, 7])('rejects %p points', (points) => {
    expect(schema.validate(grading(points)).error).toBeDefined();
  });
});

describe('grade rounding (setting per campaign)', () => {
  it.each([
    [4.33, 0.5, 4.5],
    [4.24, 0.5, 4],
    [4.37, 0.25, 4.25],
    [4.35, 0.1, 4.4],
    [4.5, 1, 5],
    [4.333, 0, 4.33],
    [-0.333, 0.1, -0.3],
  ])('roundToStep(%p, %p) = %p', (value, step, expected) => {
    expect(roundToStep(value, step)).toBe(expected);
  });

  it('default is half grades', () => {
    expect(gradeRoundingOf(undefined)).toBe(0.5);
    expect(gradeRoundingOf({ gradeRounding: null })).toBe(0.5);
    expect(gradeRoundingOf({ gradeRounding: 0.3 })).toBe(0.5);
    expect(gradeRoundingOf({ gradeRounding: 1 })).toBe(1);
  });

  it('getPeersGrade rounds the third-party average', () => {
    const service = new CalculationsService();
    const spy = jest
      .spyOn(service, 'getPeersThirdPartyAverage')
      .mockReturnValue(4.33);
    expect(service.getPeersGrade({}, {} as any, {} as any)).toBe(4.5);
    expect(
      service.getPeersGrade({ gradeRounding: 0.1 }, {} as any, {} as any),
    ).toBe(4.3);
    expect(
      service.getPeersGrade({ gradeRounding: 0 }, {} as any, {} as any),
    ).toBe(4.33);
    spy.mockRestore();
  });

  const campaign = (gradeRounding?: unknown) => ({
    name: 'Test',
    maxPoints: 6,
    language: 'de',
    allowCommentsForPeers: false,
    gradeRounding,
  });

  it.each([0.5, 0.25, 0.1, 1, 0])('accepts gradeRounding %p', (step) => {
    const r = createCampaignSchema(6).validate(campaign(step), {
      allowUnknown: true,
    });
    expect(
      r.error?.details.find((d) => d.path[0] === 'gradeRounding'),
    ).toBeUndefined();
  });

  it.each([0.3, 2, -0.5, 'x'])('rejects gradeRounding %p', (step) => {
    const r = createCampaignSchema(6).validate(campaign(step), {
      allowUnknown: true,
      abortEarly: false,
    });
    expect(
      r.error?.details.find((d) => d.path[0] === 'gradeRounding'),
    ).toBeDefined();
  });
});
