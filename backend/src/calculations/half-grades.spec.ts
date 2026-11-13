import { roundToHalf } from './calculations.service';
import { createGradingSchema } from '../validators/joi-objects';

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
