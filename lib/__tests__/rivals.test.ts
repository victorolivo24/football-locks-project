import { describe, it, expect } from 'vitest';
import {
  rankShares,
  predictRanks,
  weekOutcomes,
  titleOddsAfterWeek,
  candidateTickets,
  rankTickets,
  explainLocks,
  ticketFacts,
  WeekPlayer,
  Leg,
} from '../rivals';
import { FIELD_CORRELATION } from '../simulate';

const close = (a: number, b: number, tolerance = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tolerance);

const home = (gameId: number): Leg => ({ gameId, home: true });
const away = (gameId: number): Leg => ({ gameId, home: false });

const player = (userId: number, points: number, ticket: Leg[]): WeekPlayer => ({
  userId,
  points,
  ticket,
  size: 3,
  winProb: 0.46,
  correlation: FIELD_CORRELATION,
});

// Three games, home side favoured in each, safest first.
const probs = new Map([[1, 0.8], [2, 0.75], [3, 0.7]]);
const favourites = [home(1), home(2), home(3)];

describe('rankShares', () => {
  it('counts how often each rank was taken', () => {
    expect(rankShares([[0, 1, 2], [0, 1], [0, 2, 3]], 5)).toEqual([1, 2 / 3, 2 / 3, 1 / 3, 0]);
  });

  it('is all zeros with no history', () => {
    expect(rankShares([], 3)).toEqual([0, 0, 0]);
  });
});

describe('predictRanks', () => {
  it('takes the most-taken ranks, safest first', () => {
    expect(predictRanks([1, 0.3, 0.9, 0.1], 2)).toEqual([0, 2]);
  });

  it('falls back to the chalk with no history', () => {
    expect(predictRanks([0, 0, 0, 0], 3)).toEqual([0, 1, 2]);
  });
});

describe('weekOutcomes', () => {
  it('sums to one', () => {
    const total = weekOutcomes([player(1, 0, [home(1), home(2)]), player(2, 0, [home(3)])], probs)
      .reduce((sum, o) => sum + o.probability, 0);
    close(total, 1);
  });

  it('moves players on the same side of a game together', () => {
    const outcomes = weekOutcomes([player(1, 0, [home(1)]), player(2, 0, [home(1)])], probs);
    expect(outcomes.every(o => o.hits[0] === o.hits[1])).toBe(true);
  });

  it('never lets both sides of a game hit', () => {
    const outcomes = weekOutcomes([player(1, 0, [home(1)]), player(2, 0, [away(1)])], probs);
    expect(outcomes.every(o => o.hits[0] !== o.hits[1])).toBe(true);
  });

  it('prices a two-lock ticket as the product of its legs', () => {
    const hit = weekOutcomes([player(1, 0, [home(1), home(2)])], probs)
      .filter(o => o.hits[0])
      .reduce((sum, o) => sum + o.probability, 0);
    close(hit, 0.8 * 0.75);
  });

  it('treats an empty ticket as a miss', () => {
    expect(weekOutcomes([player(1, 0, [])], probs).every(o => !o.hits[0])).toBe(true);
  });
});

describe('titleOddsAfterWeek', () => {
  it('is exact when the season ends this week', () => {
    // Level, rival on one lock, me on two. I win only if both of mine hit; a
    // double miss is a tie; rival hitting alone wins it for them.
    const odds = titleOddsAfterWeek(
      [player(1, 0, [home(1), home(2)]), player(2, 0, [home(3)])], probs, 0
    );
    const mine = 0.8 * 0.75;
    close(odds[0], mine + 0.5 * (1 - mine) * 0.3, 1e-9);
    close(odds[0] + odds[1], 1);
  });

  it('is deterministic with weeks remaining', () => {
    const field = [player(1, 3, [home(1)]), player(2, 2, [home(1), home(2)])];
    expect(titleOddsAfterWeek(field, probs, 8)).toEqual(titleOddsAfterWeek(field, probs, 8));
  });
});

describe('candidateTickets', () => {
  it('builds every subset up to the size limit', () => {
    const tickets = candidateTickets(favourites, 2);
    expect(tickets).toHaveLength(6);
    expect(tickets.every(t => t.length <= 2)).toBe(true);
  });
});

describe('rankTickets', () => {
  it('protects a one point lead by mirroring the rival', () => {
    // Ahead by one, rival on the two safest games, season ends this week:
    // holding the same games means they can never pass me.
    const ranked = rankTickets(
      1, [player(1, 5, []), player(2, 4, [home(1), home(2)])], favourites, probs, 0
    );
    close(ranked[0].odds, 1);
    expect(ranked[0].ticket.map(l => l.gameId)).toEqual([1, 2]);
  });

  it('reaches for a bigger ticket when trailing', () => {
    // One behind with no weeks left: mirroring the rival can never catch
    // them, so the best play is the biggest ticket on the board.
    const ranked = rankTickets(
      1, [player(1, 4, []), player(2, 5, [home(1), home(2)])], favourites, probs, 0
    );
    expect(ranked[0].ticket).toHaveLength(3);
    expect(ranked[0].odds).toBeGreaterThan(ranked[ranked.length - 1].odds);
  });

  it('returns nothing for a player not in the field', () => {
    expect(rankTickets(9, [player(1, 0, [])], favourites, probs, 0)).toEqual([]);
  });
});

describe('explainLocks', () => {
  const field = [player(1, 5, [home(1)]), player(2, 4, [home(1), home(2)]), player(3, 4, [away(2)])];

  it('names who rides and who fades each game', () => {
    const [g1, g2] = explainLocks(1, field, [home(1), home(2)], probs, 0);
    expect(g1.with).toEqual([2]);
    expect(g1.against).toEqual([]);
    expect(g2.with).toEqual([2]);
    expect(g2.against).toEqual([3]);
  });

  it('measures a held lock by what removing it would cost', () => {
    const [g1] = explainLocks(1, field, [home(1)], probs, 0);
    expect(g1.held).toBe(true);
    const withIt = titleOddsAfterWeek(field, probs, 0)[0];
    const withoutIt = titleOddsAfterWeek([{ ...field[0], ticket: [] }, field[1], field[2]], probs, 0)[0];
    close(g1.delta, withIt - withoutIt);
  });

  it('splits into a hit future and a miss future around the unconditional odds', () => {
    const [g2] = explainLocks(1, field, [home(2)], probs, 0);
    expect(g2.held).toBe(false);
    expect(g2.ifHits).toBeGreaterThanOrEqual(g2.ifMisses);
    const withLock = titleOddsAfterWeek([{ ...field[0], ticket: [home(1), home(2)] }, field[1], field[2]], probs, 0)[0];
    close(0.75 * g2.ifHits + 0.25 * g2.ifMisses, withLock);
  });
});

describe('ticketFacts', () => {
  const field = [player(1, 5, []), player(2, 4, [home(1), home(2)]), player(3, 6, [home(3)])];

  it('prices the ticket and projects the points', () => {
    const facts = ticketFacts(1, field, [home(1), home(2)], probs)!;
    close(facts.hitChance, 0.8 * 0.75);
    expect(facts.pointsIfHit).toBe(7);
  });

  it('names who stays level or ahead if everyone hits', () => {
    // Hitting two takes me to 7; rival 3 would be 7 too, rival 2 only 6.
    expect(ticketFacts(1, field, [home(1), home(2)], probs)!.notClearOf).toEqual([3]);
  });

  it('knows whose ticket it matches, extends, and avoids', () => {
    const facts = ticketFacts(1, field, [home(1), home(2)], probs)!;
    expect(facts.same).toEqual([2]);
    expect(facts.extends).toEqual([]);
    expect(facts.clearOf).toEqual([3]);

    const bigger = ticketFacts(1, field, [home(1), home(2), home(3)], probs)!;
    expect(bigger.same).toEqual([]);
    expect(bigger.extends).toEqual([{ userId: 2, extra: 1, theirs: 2 }, { userId: 3, extra: 2, theirs: 1 }]);
    expect(bigger.clearOf).toEqual([]);
  });

  it('is zero chance for an empty ticket', () => {
    expect(ticketFacts(1, field, [], probs)!.hitChance).toBe(0);
  });
});
