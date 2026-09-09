import { describe, it, expect } from 'vitest';
import {
  impliedProbability,
  fairWinProbability,
  ticketProbability,
  expectedPoints,
  slateProbabilities,
  evCurve,
  bestLockCount,
} from '../luck';

const close = (a: number, b: number, tolerance = 0.001) => expect(Math.abs(a - b)).toBeLessThan(tolerance);

describe('impliedProbability', () => {
  it('prices a favourite above even money', () => {
    close(impliedProbability(-166), 166 / 266);
  });

  it('prices an underdog below even money', () => {
    close(impliedProbability(142), 100 / 242);
  });

  it('treats +100 as a coin flip', () => {
    close(impliedProbability(100), 0.5);
  });
});

describe('fairWinProbability', () => {
  it('strips the vig so both sides sum to exactly one', () => {
    const home = fairWinProbability(-166, 142);
    const away = fairWinProbability(142, -166);
    close(home + away, 1);
  });

  it('reads below the raw price, which is inflated by the margin', () => {
    expect(fairWinProbability(-166, 142)).toBeLessThan(impliedProbability(-166));
  });

  it('splits a symmetric market down the middle', () => {
    close(fairWinProbability(-110, -110), 0.5);
  });

  it('makes a heavy favourite far likelier than its opponent', () => {
    // Chargers -500 vs Cardinals +380 from the real Week 1 board.
    const favourite = fairWinProbability(-500, 380);
    close(favourite, 0.8);
    close(favourite + fairWinProbability(380, -500), 1);
  });
});

describe('ticketProbability', () => {
  it('compounds legs, so each one added cuts the ticket down', () => {
    close(ticketProbability([0.6, 0.6]), 0.36);
    expect(ticketProbability([0.6, 0.6, 0.6])).toBeLessThan(ticketProbability([0.6, 0.6]));
  });

  it('is the leg itself for a single lock', () => {
    close(ticketProbability([0.7]), 0.7);
  });

  it('is zero for an empty ticket', () => {
    expect(ticketProbability([])).toBe(0);
  });
});

describe('expectedPoints', () => {
  it('pays the ticket length times its chance of surviving', () => {
    close(expectedPoints([0.6, 0.6]), 2 * 0.36);
  });

  it('peaks and then falls as locks pile up at a fixed hit rate', () => {
    const curve = [1, 2, 3, 4, 5, 6].map(n => expectedPoints(Array(n).fill(0.65)));
    const best = curve.indexOf(Math.max(...curve));
    expect(best).toBeGreaterThan(0);
    expect(curve[curve.length - 1]).toBeLessThan(curve[best]);
  });

  it('is worth more than a longer ticket of the same odds when legs are weak', () => {
    expect(expectedPoints([0.5])).toBeGreaterThan(expectedPoints([0.5, 0.5, 0.5]));
  });

  it('is zero for an empty ticket', () => {
    expect(expectedPoints([])).toBe(0);
  });
});

describe('slateProbabilities', () => {
  it('returns the favoured side of each game, strongest first', () => {
    const probs = slateProbabilities([
      { homeMoneyline: -120, awayMoneyline: 100 },  // near coin flip
      { homeMoneyline: -500, awayMoneyline: 380 },  // heavy favourite
    ]);
    close(probs[0], 0.8);
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it('takes the underdog side when the away team is favoured', () => {
    const probs = slateProbabilities([{ homeMoneyline: 380, awayMoneyline: -500 }]);
    close(probs[0], 0.8);
  });

  it('skips games with no line', () => {
    const probs = slateProbabilities([
      { homeMoneyline: null, awayMoneyline: null },
      { homeMoneyline: -500, awayMoneyline: 380 },
    ]);
    expect(probs).toHaveLength(1);
  });
});

describe('evCurve', () => {
  const slate = [0.8, 0.75, 0.7, 0.62, 0.55];

  it('compounds down the sorted slate rather than reusing one rate', () => {
    const curve = evCurve(slate);
    close(curve[0].expected, 0.8);
    close(curve[1].expected, 2 * 0.8 * 0.75);
  });

  it('turns over where the marginal game stops paying', () => {
    const curve = evCurve(slate);
    const best = bestLockCount(curve);
    expect(best).toBeGreaterThan(1);
    expect(best).toBeLessThan(5);
    expect(curve[curve.length - 1].expected).toBeLessThan(curve[best - 1].expected);
  });

  it('never runs past the number of priced games', () => {
    expect(evCurve([0.8, 0.7], 8)).toHaveLength(2);
  });

  it('differs from the flat model, which is the point', () => {
    const real = evCurve(slate)[2].expected;          // 0.8 * 0.75 * 0.7
    const flat = 3 * Math.pow(0.8, 3);                 // pretends all three are 80%
    expect(real).toBeLessThan(flat);
  });

  it('is empty for an unpriced slate', () => {
    expect(evCurve([])).toHaveLength(0);
    expect(bestLockCount([])).toBe(0);
  });
});
