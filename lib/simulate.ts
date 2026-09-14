/**
 * Monte Carlo season simulation.
 *
 * Title odds were once a logistic curve over the points gap, tuned by hand. It
 * produced plausible percentages that did not correspond to anything: it could
 * not say what a player had to do to win, and had no notion of the season
 * running out. Playing the remaining weeks out many times answers both.
 */

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

/** The consensus ticket of a given size: the n safest games on the board. */
export function consensusRanks(size: number): number[] {
  return Array.from({ length: Math.max(0, size) }, (_, i) => i);
}

/** Weeks of evidence it takes before a player's own pace outweighs the league's. */
export const PACE_PRIOR_WEEKS = 3;

/**
 * A player's ticket size, regressed toward the league average.
 *
 * Taking an observed pace at face value overfits badly early on. After one
 * week, someone who locked a single game reads as a one-lock-per-week player
 * for the whole season, which projects them to finish near last no matter what
 * they have actually scored — their real points get swamped by a strategy they
 * have not committed to. Shrinking toward the league average fixes that, and
 * fades out on its own as weeks accumulate.
 */
export function smoothedPace(
  observedPace: number,
  leaguePace: number,
  weeksObserved: number
): number {
  if (weeksObserved <= 0) return leaguePace;
  const weight = weeksObserved / (weeksObserved + PACE_PRIOR_WEEKS);
  return observedPace * weight + leaguePace * (1 - weight);
}

/**
 * How much two chalk-picking players move together in a future week.
 *
 * Not 1: assuming everyone with the same ticket size picks the identical games
 * every week for the rest of the season makes them permanently inseparable, so
 * a one point lead in week 1 reads as unbeatable. Not 0 either: this league
 * demonstrably picks alike, three players having run the same ticket in week 1.
 * Somewhere in between, and it fades for anyone whose picks stray from chalk.
 */
export const FIELD_CORRELATION = 0.65;

export interface SeasonPlayer {
  userId: number;
  points: number;
  /** Locks per week. */
  size: number;
  /** Chance a ticket that size survives a week. */
  winProb: number;
  /** 0 to 1: how much this player's week moves with everyone else's. */
  correlation: number;
}

/**
 * Play out the remaining weeks with players partly, not perfectly, correlated.
 *
 * Each week draws one shared outcome for "how the chalk did". A player either
 * rides that draw or gets their own, according to their correlation — so
 * players on the same games usually rise and fall together but can still come
 * apart, which is what lets the standings actually change.
 */
export function simulateSeason(
  players: SeasonPlayer[],
  remainingWeeks: number,
  runs: number,
  rng: () => number
): Map<number, number> {
  const wins = new Map<number, number>();
  for (const player of players) wins.set(player.userId, 0);
  if (players.length === 0 || runs <= 0) return wins;

  const totals = new Array(players.length).fill(0);

  for (let run = 0; run < runs; run++) {
    for (let i = 0; i < players.length; i++) totals[i] = players[i].points;

    for (let week = 0; week < remainingWeeks; week++) {
      const shared = rng();

      for (let i = 0; i < players.length; i++) {
        // Two draws either way, so the stream stays deterministic regardless
        // of which branch a player takes.
        const followsField = rng() < players[i].correlation;
        const own = rng();
        const outcome = followsField ? shared : own;

        if (outcome < players[i].winProb) totals[i] += players[i].size;
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

/** Title share per player, as percentages. */
export function seasonTitleOdds(
  players: SeasonPlayer[],
  remainingWeeks: number,
  runs: number,
  rng: () => number
): Map<number, number> {
  const wins = simulateSeason(players, remainingWeeks, runs, rng);
  const odds = new Map<number, number>();
  wins.forEach((count, userId) => odds.set(userId, Number(((count / runs) * 100).toFixed(1))));
  return odds;
}

/** Median final score per player, from the same partly-correlated draws. */
export function seasonProjection(
  players: SeasonPlayer[],
  remainingWeeks: number,
  runs: number,
  rng: () => number
): Map<number, number> {
  const samples = players.map(() => [] as number[]);

  for (let run = 0; run < runs; run++) {
    const totals = players.map(p => p.points);

    for (let week = 0; week < remainingWeeks; week++) {
      const shared = rng();
      for (let i = 0; i < players.length; i++) {
        const followsField = rng() < players[i].correlation;
        const own = rng();
        if ((followsField ? shared : own) < players[i].winProb) totals[i] += players[i].size;
      }
    }

    for (let i = 0; i < players.length; i++) samples[i].push(totals[i]);
  }

  const medians = new Map<number, number>();
  players.forEach((player, i) => {
    samples[i].sort((a, b) => a - b);
    medians.set(player.userId, samples[i][Math.floor(samples[i].length / 2)] ?? player.points);
  });
  return medians;
}
