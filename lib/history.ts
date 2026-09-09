/**
 * Completed-season results from before the app tracked picks.
 *
 * 2024 was scored on pen and paper, so only final totals survive — no weekly
 * detail, no pick counts, no record of which games anyone took. That is enough
 * to answer "what does a normal season look like", and not enough to feed any
 * stat that needs picks.
 *
 * Useful as a sanity check on the market model, which is derived purely from
 * betting lines and never saw these numbers: it predicts 21.7-24.8 points for
 * the 2-4 locks per week this league actually plays, and the real spread came
 * in at 19-25.
 */
export const SEASON_2024_FINALS: Record<string, number> = {
  Victor: 25,
  Mihir: 25,
  Jihoo: 24,
  Ryan: 21,
  Chris: 20,
  Dakota: 19,
};

/** Typical finishing score, used as the par line on projections. */
export const HISTORICAL_PAR = Number(
  (Object.values(SEASON_2024_FINALS).reduce((a, b) => a + b, 0) / Object.keys(SEASON_2024_FINALS).length).toFixed(1)
);
