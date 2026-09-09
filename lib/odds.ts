import { getSeasonInsights } from './insights';
import { getWeekOdds } from './espnOdds';
import { slateProbabilities, evCurve, bestLockCount } from './luck';
import { makeRng, titleOdds, bestLeverageLocks, SimPlayer } from './simulate';
import { db } from './db';
import { games } from './db/schema';
import { and, eq } from 'drizzle-orm';

const RUNS = 20000;
const SIM_SEED = 20260909; // Fixed so the same standings always report the same odds

export interface PlayerOddsResult {
  userId: number;
  name: string;
  points: number;
  margin: number;
  odds: number;
  avgPicksPerWeek: number;
  projectedPoints: number;
  maxCeiling: number;
  leverageLocks: number; // Ticket size that maximises this player's title chance
  evLocks: number; // Ticket size that maximises points
}

/**
 * Fair win probability for a ticket of each size, taken from a real slate.
 * Falls back to a flat 65% per lock when the week has no lines stored yet.
 */
async function weeklyCurve(season: number, week: number) {
  const weekGames = await db.query.games.findMany({
    where: and(eq(games.season, season), eq(games.week, week)),
  }).catch(() => []);

  const odds = await getWeekOdds(season, week).catch(() => []);
  const oddsByGame = new Map(odds.map(o => [Number(o.gameId), o]));

  const priced = weekGames.map(g => {
    const line = oddsByGame.get(Number(g.id));
    return { homeMoneyline: line?.homeMoneyline ?? null, awayMoneyline: line?.awayMoneyline ?? null };
  });

  const curve = evCurve(slateProbabilities(priced), 8);
  if (curve.length > 0) return curve;

  return [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({
    n,
    probability: Number((Math.pow(0.65, n) * 100).toFixed(1)),
    expected: Number((n * Math.pow(0.65, n)).toFixed(2)),
  }));
}

export async function computeTitleOdds(season: number, currentWeek: number) {
  const insights = await getSeasonInsights(season, currentWeek);
  const remainingWeeks = Math.max(0, 18 - currentWeek);
  const curve = await weeklyCurve(season, currentWeek);

  const probabilityFor = (locks: number) => {
    const clamped = Math.max(1, Math.min(curve.length, Math.round(locks)));
    return (curve[clamped - 1]?.probability ?? 0) / 100;
  };

  const simPlayers: SimPlayer[] = insights.players.map(p => ({
    userId: p.userId,
    points: p.totalPoints,
    locks: Math.max(1, Math.round(p.avgPicksPerWeek || 3)),
    weekWinProb: probabilityFor(p.avgPicksPerWeek || 3),
  }));

  // Simulate the rest of the season rather than scoring the points gap on a
  // hand-tuned curve: this knows how many weeks are left to catch up in.
  const odds = titleOdds(simPlayers, remainingWeeks, RUNS, makeRng(SIM_SEED));
  const evLocks = bestLockCount(curve);

  const rows: PlayerOddsResult[] = insights.players.map((p) => {
    const bestOther = Math.max(
      0,
      ...insights.players.filter(r => r.userId !== p.userId).map(r => r.totalPoints)
    );

    const self = simPlayers.find(s => s.userId === p.userId)!;
    const rivals = simPlayers.filter(s => s.userId !== p.userId);

    // Fewer runs here: this is a per-player search over every ticket size.
    const leverage = remainingWeeks > 0
      ? bestLeverageLocks(self, rivals, curve, remainingWeeks, 3000, makeRng(SIM_SEED + p.userId))
      : { locks: self.locks, titleOdds: 0 };

    return {
      userId: p.userId,
      name: p.name,
      points: p.totalPoints,
      margin: p.totalPoints - bestOther,
      avgPicksPerWeek: p.avgPicksPerWeek,
      projectedPoints: p.projectedPoints,
      maxCeiling: p.maxCeiling,
      odds: odds.get(p.userId) ?? 0,
      leverageLocks: leverage.locks,
      evLocks,
    };
  });

  const validAvgs = insights.players.filter(p => p.avgPicksPerWeek > 0).map(p => p.avgPicksPerWeek);
  const leagueAvgPicks = validAvgs.length > 0
    ? Number((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length).toFixed(1))
    : 3;

  return {
    season,
    week: currentWeek,
    remainingWeeks,
    avgPicksPerWeek: leagueAvgPicks,
    evLocks,
    odds: rows.sort((a, b) => b.odds - a.odds),
  };
}
