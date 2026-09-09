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
 * The ticket size that maximises this player's title chance.
 *
 * Late in a season this is not the size that maximises points. Once someone is
 * far enough behind, the safe ticket that scores best on average is the one
 * that reliably keeps them second — they need the variance instead.
 */
export function bestLeverageLocks(
  player: SimPlayer,
  rivals: SimPlayer[],
  curve: Array<{ n: number; probability: number }>,
  remainingWeeks: number,
  runs: number,
  rng: () => number
): { locks: number; titleOdds: number } {
  let best = { locks: player.locks, titleOdds: -1 };

  for (const tier of curve) {
    const candidate: SimPlayer = { ...player, locks: tier.n, weekWinProb: tier.probability / 100 };
    const wins = simulateTitles([candidate, ...rivals], remainingWeeks, runs, rng);
    const share = ((wins.get(player.userId) ?? 0) / runs) * 100;
    if (share > best.titleOdds) best = { locks: tier.n, titleOdds: Number(share.toFixed(1)) };
  }

  return best;
}
