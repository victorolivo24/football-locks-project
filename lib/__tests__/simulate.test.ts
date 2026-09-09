import { describe, it, expect } from 'vitest';
import {
  makeRng,
  simulateTitles,
  titleOdds,
  bestLeverageLocks,
  correlatedTitleOdds,
  edgeOverField,
  SimPlayer,
} from '../simulate';

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
  const board = [0.8, 0.79, 0.73, 0.66, 0.65, 0.64];

  it('tells a player behind to take on more variance than the EV pick', () => {
    // EV peaks at 3 locks here. Chasing a frozen 8 points over two weeks,
    // 3 locks tops out at 6 and cannot win at all, so the right play is a
    // bigger ticket even though it scores worse on average.
    const frozenLeader = { userId: 2, points: 8, ranks: [] as number[] };
    const best = bestLeverageLocks({ userId: 1, points: 0 }, [frozenLeader], board, 6, 2, 3000, 41);
    expect(best.locks).toBeGreaterThan(3);
  });

  it('does not chase variance when already well ahead', () => {
    const behind = { userId: 2, points: 2, ranks: [0, 1, 2] };
    const best = bestLeverageLocks({ userId: 1, points: 25 }, [behind], board, 6, 2, 3000, 42);
    expect(best.titleOdds).toBeGreaterThan(90);
  });

  it('returns a size within the board it was given', () => {
    const rival = { userId: 2, points: 5, ranks: [0, 1, 2] };
    const best = bestLeverageLocks({ userId: 1, points: 5 }, [rival], board, 6, 4, 2000, 43);
    expect(best.locks).toBeGreaterThanOrEqual(1);
    expect(best.locks).toBeLessThanOrEqual(6);
  });
});

describe('simulateCorrelated', () => {
  // A board where the safest game is near certain and later ones are coin flips.
  const board = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
  const strat = (userId: number, points: number, ranks: number[]) => ({ userId, points, ranks });

  it('never separates players holding the identical ticket', () => {
    // Same games, same result, every week: a tie is the only possible outcome.
    const odds = correlatedTitleOdds(
      [strat(1, 0, [0, 1, 2]), strat(2, 0, [0, 1, 2])],
      board, 10, 3000, makeRng(21)
    );
    expect(odds.get(1)).toBe(50);
    expect(odds.get(2)).toBe(50);
  });

  it('lets a differentiated ticket break the tie', () => {
    // Swapping one leg for another game is the only way to finish apart.
    const odds = correlatedTitleOdds(
      [strat(1, 0, [0, 1, 2]), strat(2, 0, [0, 1, 3])],
      board, 10, 3000, makeRng(22)
    );
    expect(odds.get(1)).not.toBe(50);
  });

  it('still totals 100 across the league', () => {
    const odds = correlatedTitleOdds(
      [strat(1, 3, [0, 1, 2]), strat(2, 0, [0, 1, 3]), strat(3, 1, [0, 1])],
      board, 8, 3000, makeRng(23)
    );
    let sum = 0;
    odds.forEach((v) => { sum += v; });
    expect(Math.abs(sum - 100)).toBeLessThan(0.5);
  });

  it('separates less than an independent model claims', () => {
    // The independent version thinks identical tickets can finish apart, so it
    // hands one of them the title outright far more often than is possible.
    const identical = [strat(1, 0, [0, 1, 2]), strat(2, 0, [0, 1, 2])];
    const correlated = correlatedTitleOdds(identical, board, 10, 3000, makeRng(24));
    const p = board[0] * board[1] * board[2];
    const independent = titleOdds(
      [{ userId: 1, points: 0, locks: 3, weekWinProb: p }, { userId: 2, points: 0, locks: 3, weekWinProb: p }],
      10, 3000, makeRng(24)
    );
    expect(correlated.get(1)).toBe(50);
    expect(independent.get(1)).not.toBe(50);
  });

  it('scores nothing for a player sitting out', () => {
    const odds = correlatedTitleOdds(
      [strat(1, 0, [0, 1]), strat(2, 0, [])],
      board, 6, 2000, makeRng(25)
    );
    expect(odds.get(2)).toBe(0);
  });
});

describe('edgeOverField', () => {
  const board = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
  const strat = (userId: number, points: number, ranks: number[]) => ({ userId, points, ranks });

  it('is zero for a player already holding the consensus ticket', () => {
    // Copying the field IS the plan, so there is nothing to isolate.
    const result = edgeOverField(
      strat(1, 0, [0, 1, 2]),
      [strat(2, 0, [0, 1, 2]), strat(3, 0, [0, 1, 2])],
      board, 6, 2000, 31
    );
    expect(result.edge).toBe(0);
  });

  it('pays a player who is behind for breaking from the field', () => {
    // Trailing the pack while holding their exact ticket is unrecoverable:
    // everyone moves together and the gap never closes.
    const result = edgeOverField(
      strat(1, 0, [0, 1, 3]),
      [strat(2, 6, [0, 1, 2]), strat(3, 6, [0, 1, 2])],
      board, 4, 4000, 32
    );
    expect(result.edge).toBeGreaterThan(0);
  });

  it('reports the odds it compared', () => {
    const result = edgeOverField(
      strat(1, 0, [0, 1, 3]),
      [strat(2, 2, [0, 1, 2])],
      board, 5, 2000, 33
    );
    expect(result.edge).toBeCloseTo(result.odds - result.consensusOdds, 1);
  });
});
