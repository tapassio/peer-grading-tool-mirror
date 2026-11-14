import { gradeRoundingOf, roundToHalf, roundToStep } from './campaign.service';

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

describe('roundToStep (setting "Rundung der Note")', () => {
  it.each([
    [4.33, 0.5, 4.5],
    [4.24, 0.5, 4],
    [4.25, 0.5, 4.5],
    [4.37, 0.25, 4.25],
    [4.38, 0.25, 4.5],
    [4.35, 0.1, 4.4],
    [4.34, 0.1, 4.3],
    [4.5, 1, 5],
    [4.49, 1, 4],
    [4.333, 0, 4.33],
    [-0.333, 0.1, -0.3],
    [-0.05, 0.1, -0.1],
    [-0.04, 0.1, 0],
  ])('%p with step %p -> %p', (value, step, expected) => {
    expect(roundToStep(value, step)).toBe(expected);
  });

  it('unknown or missing setting -> half grades', () => {
    expect(gradeRoundingOf(undefined)).toBe(0.5);
    expect(gradeRoundingOf({})).toBe(0.5);
    expect(gradeRoundingOf({ gradeRounding: 0.3 })).toBe(0.5);
    expect(gradeRoundingOf({ gradeRounding: 0 })).toBe(0);
    expect(gradeRoundingOf({ gradeRounding: 0.25 })).toBe(0.25);
  });
});
