import { roundToHalf } from './campaign.service';

describe('roundToHalf (deviations on half grades)', () => {
  it.each([
    [0, 0],
    [0.24, 0],
    [0.25, 0.5],
    [0.33, 0.5],
    [0.74, 0.5],
    [0.75, 1],
    [1.26, 1.5],
    [-0.24, 0],
    [-0.25, -0.5],
    [-0.33, -0.5],
    [-0.75, -1],
    [4.33 - 4.08, 0.5], // floating point: 0.2499999...
  ])('%p -> %p', (input, expected) => {
    expect(roundToHalf(input)).toBe(expected);
  });

  it('never returns -0', () => {
    expect(Object.is(roundToHalf(-0.1), 0)).toBe(true);
  });
});
