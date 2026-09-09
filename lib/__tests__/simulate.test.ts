import { describe, it, expect } from 'vitest';
import { makeRng, simulateTitles, titleOdds, bestLeverageLocks, SimPlayer } from '../simulate';

const player = (userId: number, points: number, locks = 3, weekWinProb = 0.45): SimPlayer =>
  ({ userId, points, locks, weekWinProb });

const RUNS = 4000;

describe('makeRng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(7), b = makeRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays inside [0, 1)', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('simulateTitles', () => {
  it('gives the whole title to a lead that cannot be caught', () => {
    // No weeks left, so the standings are final.
    const odds = titleOdds([player(1, 20), player(2, 5)], 0, 100, makeRng(1));
    expect(odds.get(1)).toBe(100);
    expect(odds.get(2)).toBe(0);
  });

  it('splits a dead heat evenly', () => {
    const odds = titleOdds([player(1, 10), player(2, 10)], 0, 100, makeRng(2));
    expect(odds.get(1)).toBe(50);
    expect(odds.get(2)).toBe(50);
  });

  it('always totals 100 across the league', () => {
    const odds = titleOdds([player(1, 8), player(2, 5), player(3, 2)], 6, RUNS, makeRng(3));
    let sum = 0;
    odds.forEach((v) => { sum += v; });
    expect(Math.abs(sum - 100)).toBeLessThan(0.5);
  });

  it('favours the player who is ahead, all else equal', () => {
    const odds = titleOdds([player(1, 12), player(2, 6)], 5, RUNS, makeRng(4));
    expect(odds.get(1)!).toBeGreaterThan(odds.get(2)!);
  });

  it('erodes a lead as more weeks remain', () => {
    const short = titleOdds([player(1, 12), player(2, 6)], 2, RUNS, makeRng(5)).get(1)!;
    const long = titleOdds([player(1, 12), player(2, 6)], 12, RUNS, makeRng(5)).get(1)!;
    expect(long).toBeLessThan(short);
  });

  it('rates the better ticket higher from level points', () => {
    const strong = player(1, 0, 3, 0.6);
    const weak = player(2, 0, 3, 0.3);
    const odds = titleOdds([strong, weak], 8, RUNS, makeRng(6));
    expect(odds.get(1)!).toBeGreaterThan(odds.get(2)!);
  });

  it('handles an empty league without dividing by zero', () => {
    expect(simulateTitles([], 5, 10, makeRng(8)).size).toBe(0);
  });
});

describe('bestLeverageLocks', () => {
  const curve = [
    { n: 1, probability: 80 },
    { n: 2, probability: 63 },
    { n: 3, probability: 46 },
    { n: 4, probability: 30 },
    { n: 5, probability: 19 },
    { n: 6, probability: 12 },
  ];

  it('tells a player behind to take on more variance than the EV pick', () => {
    // EV peaks at 3 locks on this curve. Chasing a fixed 8 points over two
    // weeks, 3 locks tops out at 6 and cannot win at all, so the right play is
    // a bigger ticket even though it scores worse on average.
    const behind = player(1, 0, 3, 0.46);
    const frozenLeader = { userId: 2, points: 8, locks: 0, weekWinProb: 0 };
    const best = bestLeverageLocks(behind, [frozenLeader], curve, 2, RUNS, makeRng(11));
    expect(best.locks).toBeGreaterThan(3);
  });

  it('prefers the EV-maximising ticket when the race is even', () => {
    // Level points and a full season left: no reason to reach past the peak.
    const even = player(1, 0, 3, 0.46);
    const rival = player(2, 0, 3, 0.46);
    const best = bestLeverageLocks(even, [rival], curve, 12, RUNS, makeRng(14));
    expect(best.locks).toBeLessThanOrEqual(3);
  });

  it('does not chase variance when already well ahead', () => {
    const leader = player(1, 25, 3, 0.46);
    const behind = player(2, 2, 3, 0.46);
    const best = bestLeverageLocks(leader, [behind], curve, 2, RUNS, makeRng(12));
    expect(best.titleOdds).toBeGreaterThan(90);
  });

  it('returns a size drawn from the offered curve', () => {
    const best = bestLeverageLocks(player(1, 5), [player(2, 5)], curve, 4, 800, makeRng(13));
    expect(curve.some(t => t.n === best.locks)).toBe(true);
  });
});
