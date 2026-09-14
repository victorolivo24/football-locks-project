import { describe, it, expect } from 'vitest';
import { makeRng, simulateSeason, seasonTitleOdds, seasonProjection, SeasonPlayer, FIELD_CORRELATION } from '../simulate';

const player = (userId: number, points: number, over: Partial<SeasonPlayer> = {}): SeasonPlayer => ({
  userId,
  points,
  size: 3,
  winProb: 0.46,
  correlation: FIELD_CORRELATION,
  ...over,
});

const RUNS = 6000;

describe('simulateSeason', () => {
  it('settles the standings when no weeks remain', () => {
    const odds = seasonTitleOdds([player(1, 10), player(2, 4)], 0, 200, makeRng(1));
    expect(odds.get(1)).toBe(100);
    expect(odds.get(2)).toBe(0);
  });

  it('always totals 100', () => {
    const odds = seasonTitleOdds([player(1, 3), player(2, 1), player(3, 0)], 8, RUNS, makeRng(2));
    let sum = 0;
    odds.forEach(v => { sum += v; });
    expect(Math.abs(sum - 100)).toBeLessThan(0.5);
  });

  it('leaves a one point lead beatable over a season', () => {
    // The whole reason this model exists: identical tickets never separating
    // made a week-one point lead mathematically unbeatable.
    const odds = seasonTitleOdds([player(1, 1), player(2, 0), player(3, 0)], 17, RUNS, makeRng(3));
    expect(odds.get(2)!).toBeGreaterThan(5);
    expect(odds.get(3)!).toBeGreaterThan(5);
  });

  it('still rewards the player who is ahead', () => {
    const odds = seasonTitleOdds([player(1, 6), player(2, 0)], 10, RUNS, makeRng(4));
    expect(odds.get(1)!).toBeGreaterThan(odds.get(2)!);
  });

  it('keeps identical players close to even when level', () => {
    const odds = seasonTitleOdds([player(1, 0), player(2, 0)], 12, RUNS, makeRng(5));
    expect(Math.abs(odds.get(1)! - odds.get(2)!)).toBeLessThan(6);
  });

  it('separates less when players are more correlated', () => {
    const tight = seasonTitleOdds(
      [player(1, 1, { correlation: 0.95 }), player(2, 0, { correlation: 0.95 })], 17, RUNS, makeRng(6)
    );
    const loose = seasonTitleOdds(
      [player(1, 1, { correlation: 0.2 }), player(2, 0, { correlation: 0.2 })], 17, RUNS, makeRng(6)
    );
    // Trailing by one is more recoverable when you are not locked to the leader.
    expect(loose.get(2)!).toBeGreaterThan(tight.get(2)!);
  });

  it('prefers the better ticket from level points', () => {
    const odds = seasonTitleOdds(
      [player(1, 0, { winProb: 0.6 }), player(2, 0, { winProb: 0.25 })], 12, RUNS, makeRng(7)
    );
    expect(odds.get(1)!).toBeGreaterThan(odds.get(2)!);
  });

  it('handles an empty league', () => {
    expect(simulateSeason([], 5, 10, makeRng(8)).size).toBe(0);
  });
});

describe('seasonProjection', () => {
  it('returns current points with the season over', () => {
    expect(seasonProjection([player(1, 14)], 0, 100, makeRng(9)).get(1)).toBe(14);
  });

  it('projects a bigger ticket that cashes rarely below a steady one', () => {
    const finish = seasonProjection(
      [player(1, 0, { size: 3, winProb: 0.46 }), player(2, 0, { size: 6, winProb: 0.12 })],
      17, RUNS, makeRng(10)
    );
    expect(finish.get(2)!).toBeLessThan(finish.get(1)!);
  });

  it('builds on points already banked', () => {
    const finish = seasonProjection([player(1, 9)], 4, 1000, makeRng(11));
    expect(finish.get(1)!).toBeGreaterThanOrEqual(9);
  });
});
