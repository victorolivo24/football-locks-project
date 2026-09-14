import { describe, it, expect } from 'vitest';
import { smoothedPace, PACE_PRIOR_WEEKS } from '../simulate';

describe('smoothedPace', () => {
  it('barely moves off the league average after one week', () => {
    // One week is not evidence that someone is a one-lock player forever.
    const pace = smoothedPace(1, 3.3, 1);
    expect(pace).toBeGreaterThan(2.5);
    expect(pace).toBeLessThan(3);
  });

  it('pulls a high-volume week back toward the field too', () => {
    const pace = smoothedPace(6, 3.3, 1);
    expect(pace).toBeLessThan(4.5);
    expect(pace).toBeGreaterThan(3.3);
  });

  it('trusts the player more as weeks accumulate', () => {
    const early = smoothedPace(1, 3.3, 1);
    const later = smoothedPace(1, 3.3, 10);
    expect(later).toBeLessThan(early);
    expect(later).toBeLessThan(1.8);
  });

  it('converges on the observed pace over a full season', () => {
    expect(smoothedPace(5, 3, 17)).toBeCloseTo(5 * (17 / 20) + 3 * (3 / 20), 5);
    expect(Math.abs(smoothedPace(5, 3, 60) - 5)).toBeLessThan(0.15);
  });

  it('is the league average with nothing observed', () => {
    expect(smoothedPace(1, 3.3, 0)).toBe(3.3);
  });

  it('leaves a player already at the league average alone', () => {
    expect(smoothedPace(3, 3, 4)).toBeCloseTo(3, 5);
  });

  it('weights by the documented prior', () => {
    const w = 2 / (2 + PACE_PRIOR_WEEKS);
    expect(smoothedPace(6, 3, 2)).toBeCloseTo(6 * w + 3 * (1 - w), 5);
  });
});
