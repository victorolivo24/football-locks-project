import { getSeasonInsights } from './insights';
import { getWeekOdds } from './espnOdds';
import { fairWinProbability, evCurve, bestLockCount } from './luck';
import {
  makeRng,
  correlatedTitleOdds,
  edgeOverField,
  bestLeverageLocks,
  consensusRanks,
  SimStrategy,
} from './simulate';
import { db } from './db';
import { games, picks } from './db/schema';
import { and, eq } from 'drizzle-orm';
import { isSameTeam } from './teams';

const RUNS = 20000;
const LEVERAGE_RUNS = 3000;
const SEED = 20260909; // Fixed so the same standings always report the same odds

export interface PlayerOddsResult {
  userId: number;
  name: string;
  points: number;
  margin: number;
  odds: number;
  avgPicksPerWeek: number;
  projectedPoints: number;
  maxCeiling: number;
  leverageLocks: number; // Consensus size that maximises title chance
  evLocks: number; // Size that maximises points
  edge: number; // Title points their deviation from the field is worth
  consensusOdds: number; // What they would have if they simply copied the field
}

/**
 * Rank the week's board safest-first and record where each player sits on it.
 *
 * Ranks are what make correlation work: two players on the same ranks hold the
 * same games, so they can never finish a week apart.
 */
async function readBoard(season: number, week: number) {
  const weekGames = await db.query.games.findMany({
    where: and(eq(games.season, season), eq(games.week, week)),
  }).catch(() => []);

  const lines = await getWeekOdds(season, week).catch(() => []);
  const linesByGame = new Map(lines.map(l => [Number(l.gameId), l]));

  const priced = weekGames
    .map(game => {
      const line = linesByGame.get(Number(game.id));
      if (line?.homeMoneyline == null || line?.awayMoneyline == null) return null;
      const home = fairWinProbability(line.homeMoneyline, line.awayMoneyline);
      return {
        gameId: Number(game.id),
        favourite: home >= 0.5 ? game.homeTeam : game.awayTeam,
        probability: Math.max(home, 1 - home),
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .sort((a, b) => b.probability - a.probability);

  const rankByGame = new Map<number, number>();
  priced.forEach((game, index) => rankByGame.set(game.gameId, index));

  const weekPicks = await db.query.picks.findMany({
    where: and(eq(picks.season, season), eq(picks.week, week)),
  }).catch(() => []);

  // Only count a pick as taking the board position if they backed the
  // favourite; siding with a dog is a different bet than that rank represents.
  const ranksByUser = new Map<number, number[]>();
  for (const pick of weekPicks) {
    const rank = rankByGame.get(Number(pick.gameId));
    if (rank === undefined) continue;
    const game = priced[rank];
    if (!isSameTeam(game.favourite, pick.pickedTeam)) continue;

    const existing = ranksByUser.get(pick.userId as number) ?? [];
    existing.push(rank);
    ranksByUser.set(pick.userId as number, existing);
  }

  return {
    probabilities: priced.map(g => g.probability),
    ranksByUser,
  };
}

export async function computeTitleOdds(season: number, currentWeek: number) {
  const insights = await getSeasonInsights(season, currentWeek);
  const remainingWeeks = Math.max(0, 18 - currentWeek);
  const board = await readBoard(season, currentWeek);

  // No lines stored yet: fall back to a flat board so the card still renders.
  const probabilities = board.probabilities.length > 0
    ? board.probabilities
    : Array.from({ length: 8 }, () => 0.65);

  const curve = evCurve(probabilities, 8);
  const evLocks = bestLockCount(curve);

  // Everyone is assumed to keep playing the shape of ticket they played this
  // week: same size, same distance from the chalk.
  const strategies: SimStrategy[] = insights.players.map(p => {
    const actual = board.ranksByUser.get(p.userId);
    const size = Math.max(1, Math.round(p.avgPicksPerWeek || 3));
    return {
      userId: p.userId,
      points: p.totalPoints,
      ranks: actual && actual.length > 0 ? actual : consensusRanks(size),
    };
  });

  const odds = correlatedTitleOdds(strategies, probabilities, remainingWeeks, RUNS, makeRng(SEED));

  const rows: PlayerOddsResult[] = insights.players.map((p) => {
    const bestOther = Math.max(
      0,
      ...insights.players.filter(r => r.userId !== p.userId).map(r => r.totalPoints)
    );

    const self = strategies.find(s => s.userId === p.userId)!;
    const rivals = strategies.filter(s => s.userId !== p.userId);

    const edge = remainingWeeks > 0
      ? edgeOverField(self, rivals, probabilities, remainingWeeks, LEVERAGE_RUNS, SEED + p.userId)
      : { odds: 0, consensusOdds: 0, edge: 0 };

    const leverage = remainingWeeks > 0
      ? bestLeverageLocks(self, rivals, probabilities, 8, remainingWeeks, LEVERAGE_RUNS, SEED + p.userId)
      : { locks: self.ranks.length, titleOdds: 0 };

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
      edge: edge.edge,
      consensusOdds: edge.consensusOdds,
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
