/**
 * Market-implied expectation for all-or-nothing tickets.
 *
 * Every stat built on a player's own history needs many weeks before it says
 * anything. Pricing their ticket against the closing line instead gives a
 * meaningful number from the very first week: what the slate they picked was
 * actually worth, versus what they scored.
 */

/** The book's implied probability for American odds. Includes the vig. */
export function impliedProbability(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

/**
 * Fair win probability for the side that was picked.
 *
 * Both sides of a market add up to more than 100% — that surplus is the
 * book's margin. Normalising the pair strips it out, so a -166 favourite
 * reads as roughly 60% rather than the 62% the raw price implies.
 */
export function fairWinProbability(pickedOdds: number, opponentOdds: number): number {
  const picked = impliedProbability(pickedOdds);
  const opponent = impliedProbability(opponentOdds);
  const overround = picked + opponent;
  if (overround <= 0) return 0;
  return picked / overround;
}

/** Probability that every leg of a ticket hits. */
export function ticketProbability(legProbabilities: number[]): number {
  if (legProbabilities.length === 0) return 0;
  return legProbabilities.reduce((product, p) => product * p, 1);
}

/**
 * Expected points from an all-or-nothing ticket.
 *
 * The ticket pays its own length or nothing, so the expectation is
 * N x P(all N hit) — which is why stacking more locks stops paying.
 */
export function expectedPoints(legProbabilities: number[]): number {
  return legProbabilities.length * ticketProbability(legProbabilities);
}

export interface EvTier {
  n: number;
  probability: number; // Chance all n locks hit, as a percentage
  expected: number; // Expected points for that ticket size
}

/**
 * Fair probability of the favoured side of each priced game, best first.
 *
 * Picking the n likeliest games is the strongest ticket of that length
 * available on the slate, so this ordering is what the EV curve walks down.
 */
export function slateProbabilities(
  games: Array<{ homeMoneyline?: number | null; awayMoneyline?: number | null }>
): number[] {
  const probabilities: number[] = [];

  for (const game of games) {
    if (game.homeMoneyline == null || game.awayMoneyline == null) continue;
    const home = fairWinProbability(game.homeMoneyline, game.awayMoneyline);
    probabilities.push(Math.max(home, 1 - home));
  }

  return probabilities.sort((a, b) => b - a);
}

/**
 * Expected points for every ticket size against a real slate.
 *
 * The flat p^n model assumes every lock is equally safe, which is the one
 * thing that is never true: each lock you add is the worst game left. Walking
 * the actual sorted probabilities gives a curve that turns over where this
 * week's board says it should, not where an average would put it.
 */
export function evCurve(sortedProbabilities: number[], maxN = 8): EvTier[] {
  const tiers: EvTier[] = [];
  let running = 1;

  for (let n = 1; n <= Math.min(maxN, sortedProbabilities.length); n++) {
    running *= sortedProbabilities[n - 1];
    tiers.push({
      n,
      probability: Number((running * 100).toFixed(1)),
      expected: Number((n * running).toFixed(2)),
    });
  }

  return tiers;
}

/** Ticket size with the highest expected points. Zero when the slate is unpriced. */
export function bestLockCount(curve: EvTier[]): number {
  if (curve.length === 0) return 0;
  return curve.reduce((best, tier) => (tier.expected > best.expected ? tier : best), curve[0]).n;
}
