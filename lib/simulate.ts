/**
 * Monte Carlo season simulation.
 *
 * The previous title odds were a logistic curve over the points gap, tuned by
 * hand. It produced plausible-looking percentages that did not correspond to
 * anything: it could not say what a player actually had to do to win, and it
 * had no notion of the season running out. Playing the remaining weeks out
 * many times answers both, and lets us ask a different question than "who is
 * ahead" — namely, what should someone behind actually do about it.
 */

export interface SimPlayer {
  userId: number;
  points: number; // Points banked so far
  locks: number; // Locks per week this player takes
  weekWinProb: number; // Chance a ticket that size survives a week
}

/** Small deterministic PRNG so simulations are reproducible in tests. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Play the rest of the season `runs` times and count titles.
 *
 * A tie at the top splits the title evenly, so the shares always total 1.
 */
export function simulateTitles(
  players: SimPlayer[],
  remainingWeeks: number,
  runs: number,
  rng: () => number
): Map<number, number> {
  const wins = new Map<number, number>();
  for (const player of players) wins.set(player.userId, 0);
  if (players.length === 0 || runs <= 0) return wins;

  const totals = new Array(players.length).fill(0);

  for (let run = 0; run < runs; run++) {
    let best = -Infinity;

    for (let i = 0; i < players.length; i++) {
      let score = players[i].points;
      for (let week = 0; week < remainingWeeks; week++) {
        // All or nothing: the whole ticket survives, or the week is a zero.
        if (rng() < players[i].weekWinProb) score += players[i].locks;
      }
      totals[i] = score;
      if (score > best) best = score;
    }

    const leaders: number[] = [];
    for (let i = 0; i < players.length; i++) if (totals[i] === best) leaders.push(i);

    const share = 1 / leaders.length;
    for (const i of leaders) {
      wins.set(players[i].userId, (wins.get(players[i].userId) ?? 0) + share);
    }
  }

  return wins;
}

/** Title share per player, as percentages summing to 100. */
export function titleOdds(
  players: SimPlayer[],
  remainingWeeks: number,
  runs: number,
  rng: () => number
): Map<number, number> {
  const wins = simulateTitles(players, remainingWeeks, runs, rng);
  const odds = new Map<number, number>();
  wins.forEach((count, userId) => {
    odds.set(userId, Number(((count / runs) * 100).toFixed(1)));
  });
  return odds;
}

/**
 * A player's plan expressed as positions on the board.
 *
 * Ranks are indexes into the slate sorted safest-first, so [0,1,2] is "the
 * three biggest favourites" — the consensus ticket. Two players holding the
 * same ranks hold the same games.
 */
export interface SimStrategy {
  userId: number;
  points: number;
  ranks: number[];
}

/**
 * Play the season out drawing each GAME once per week, not each player.
 *
 * This is the difference between a league that can separate and one that
 * cannot. Flipping a coin per player implies two people holding the same
 * ticket can finish the week differently, which is impossible — they are
 * betting on the same games. Drawing the board once and scoring every ticket
 * against it makes identical tickets move together, so the standings only
 * change when somebody actually picked something different.
 */
export function simulateCorrelated(
  players: SimStrategy[],
  rankProbabilities: number[],
  remainingWeeks: number,
  runs: number,
  rng: () => number
): Map<number, number> {
  const wins = new Map<number, number>();
  for (const player of players) wins.set(player.userId, 0);
  if (players.length === 0 || runs <= 0) return wins;

  const totals = new Array(players.length).fill(0);
  const hit = new Array(rankProbabilities.length).fill(false);

  for (let run = 0; run < runs; run++) {
    for (let i = 0; i < players.length; i++) totals[i] = players[i].points;

    for (let week = 0; week < remainingWeeks; week++) {
      // One draw per position on the board, shared by everyone who took it.
      for (let r = 0; r < rankProbabilities.length; r++) {
        hit[r] = rng() < rankProbabilities[r];
      }

      for (let i = 0; i < players.length; i++) {
        const ranks = players[i].ranks;
        if (ranks.length === 0) continue;

        let survived = true;
        for (const rank of ranks) {
          if (!hit[rank]) { survived = false; break; }
        }
        if (survived) totals[i] += ranks.length;
      }
    }

    let best = -Infinity;
    for (let i = 0; i < players.length; i++) if (totals[i] > best) best = totals[i];

    const leaders: number[] = [];
    for (let i = 0; i < players.length; i++) if (totals[i] === best) leaders.push(i);

    const share = 1 / leaders.length;
    for (const i of leaders) {
      wins.set(players[i].userId, (wins.get(players[i].userId) ?? 0) + share);
    }
  }

  return wins;
}

/** Title share per player under correlated draws, as percentages. */
export function correlatedTitleOdds(
  players: SimStrategy[],
  rankProbabilities: number[],
  remainingWeeks: number,
  runs: number,
  rng: () => number
): Map<number, number> {
  const wins = simulateCorrelated(players, rankProbabilities, remainingWeeks, runs, rng);
  const odds = new Map<number, number>();
  wins.forEach((count, userId) => odds.set(userId, Number(((count / runs) * 100).toFixed(1))));
  return odds;
}

/** The consensus ticket of a given size: the n safest games on the board. */
export function consensusRanks(size: number): number[] {
  return Array.from({ length: Math.max(0, size) }, (_, i) => i);
}

/**
 * What a player's plan is worth against the field, in title probability.
 *
 * The EV-best ticket is the n biggest favourites, so if everyone plays it
 * everyone holds the same games and nobody can pass anybody: correct on
 * points, worth nothing on winning. This scores a plan against the
 * alternative of simply copying the field at the same ticket size, which
 * isolates what the deviation itself buys.
 */
export function edgeOverField(
  player: SimStrategy,
  rivals: SimStrategy[],
  rankProbabilities: number[],
  remainingWeeks: number,
  runs: number,
  seed: number
): { odds: number; consensusOdds: number; edge: number } {
  const field = [player, ...rivals];
  const actual = correlatedTitleOdds(field, rankProbabilities, remainingWeeks, runs, makeRng(seed))
    .get(player.userId) ?? 0;

  const copying: SimStrategy = { ...player, ranks: consensusRanks(player.ranks.length) };
  const consensus = correlatedTitleOdds([copying, ...rivals], rankProbabilities, remainingWeeks, runs, makeRng(seed))
    .get(player.userId) ?? 0;

  return {
    odds: actual,
    consensusOdds: consensus,
    edge: Number((actual - consensus).toFixed(1)),
  };
}

/**
 * The consensus ticket size that maximises this player's title chance.
 *
 * Late in a season this is not the size that maximises points. Once someone is
 * far enough behind, the safe ticket that scores best on average is the one
 * that reliably keeps them second — they need the variance instead.
 */
export function bestLeverageLocks(
  player: { userId: number; points: number },
  rivals: SimStrategy[],
  rankProbabilities: number[],
  maxLocks: number,
  remainingWeeks: number,
  runs: number,
  seed: number
): { locks: number; titleOdds: number } {
  let best = { locks: 1, titleOdds: -1 };

  for (let n = 1; n <= Math.min(maxLocks, rankProbabilities.length); n++) {
    const candidate: SimStrategy = { userId: player.userId, points: player.points, ranks: consensusRanks(n) };
    const share = correlatedTitleOdds([candidate, ...rivals], rankProbabilities, remainingWeeks, runs, makeRng(seed))
      .get(player.userId) ?? 0;
    if (share > best.titleOdds) best = { locks: n, titleOdds: share };
  }

  return best;
}
