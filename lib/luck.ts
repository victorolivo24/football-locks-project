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
