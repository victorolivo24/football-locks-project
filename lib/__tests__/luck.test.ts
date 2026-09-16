import { describe, it, expect } from 'vitest';
import {
  impliedProbability,
  fairWinProbability,
  ticketProbability,
  expectedPoints,
  slateProbabilities,
  evCurve,
  bestLockCount,
  sideWinChance,
  liveTicketChance,
  atLockChance,
  LiveGame,
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

describe('live chances', () => {
  const g = (over: Partial<LiveGame> = {}): LiveGame => ({
    homeTeam: 'Seattle Seahawks', awayTeam: 'New England Patriots', status: 'scheduled',
    winnerTeam: null, homeWinProb: null, homeMoneyline: -166, awayMoneyline: 142, ...over,
  });

  it('uses the closing line before kickoff', () => {
    close(sideWinChance(g(), true)!, fairWinProbability(-166, 142));
  });

  it('switches to the live number once the game is on', () => {
    expect(sideWinChance(g({ status: 'in_progress', homeWinProb: 0.3 }), true)).toBe(0.3);
    close(sideWinChance(g({ status: 'in_progress', homeWinProb: 0.3 }), false)!, 0.7);
  });

  it('settles to 1 or 0 at the final, with a tie as a miss', () => {
    expect(sideWinChance(g({ status: 'final', winnerTeam: 'Seattle Seahawks' }), true)).toBe(1);
    expect(sideWinChance(g({ status: 'final', winnerTeam: 'Seattle Seahawks' }), false)).toBe(0);
    expect(sideWinChance(g({ status: 'final', winnerTeam: null }), true)).toBe(0);
    // Winners are stored as nicknames while teams are stored in full.
    expect(sideWinChance(g({ status: 'final', winnerTeam: 'Seahawks' }), true)).toBe(1);
  });

  it('has no number with neither a line nor a live feed', () => {
    expect(sideWinChance(g({ homeMoneyline: null, awayMoneyline: null }), true)).toBeNull();
  });

  it('multiplies the legs, and a dead leg kills the ticket', () => {
    close(liveTicketChance([1, 0.5, 0.8])!, 0.4);
    expect(liveTicketChance([1, 0, 0.9])).toBe(0);
    expect(liveTicketChance([0.5, null])).toBeNull();
    expect(liveTicketChance([])).toBeNull();
  });
});

describe('atLockChance', () => {
  const games = [
    { id: 1, homeTeam: 'Seattle Seahawks', homeMoneyline: -166, awayMoneyline: 142 },
    { id: 2, homeTeam: 'Detroit Lions', homeMoneyline: -310, awayMoneyline: 250 },
  ];

  it('multiplies each leg by its devigged closing line', () => {
    close(
      atLockChance([{ gameId: 1, pickedTeam: 'Seahawks' }, { gameId: 2, pickedTeam: 'New Orleans Saints' }], games)!,
      fairWinProbability(-166, 142) * fairWinProbability(250, -310)
    );
  });

  it('has no number for an empty ticket or an unpriced game', () => {
    expect(atLockChance([], games)).toBeNull();
    expect(atLockChance([{ gameId: 9, pickedTeam: 'Bills' }], games)).toBeNull();
  });
});
