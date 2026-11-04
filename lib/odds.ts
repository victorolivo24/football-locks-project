import { getSeasonInsights } from './insights';
import { fairWinProbability, evCurve, bestLockCount } from './luck';
import {
  makeRng,
  seasonTitleOdds,
  seasonProjection,
  consensusRanks,
  smoothedPace,
  FIELD_CORRELATION,
  SeasonPlayer,
} from './simulate';
import { rankShares } from './rivals';
import { db } from './db';
import { games, picks, gameOdds } from './db/schema';
import { eq } from 'drizzle-orm';
import { isSameTeam } from './teams';
import { HISTORICAL_PAR } from './history';

const RUNS = 20000;
const SEED = 20260909; // Fixed so the same standings always report the same odds

export interface PlayerOddsResult {
  userId: number;
  name: string;
  points: number;
  margin: number;
  odds: number;
  avgPicksPerWeek: number;
  /** Pace actually used in the simulation, after regressing toward the field. */
  simulatedPace: number;
  projectedPoints: number;
  maxCeiling: number;
  projectedFinish: number; // Median simulated final score
  /** Chance a ticket of their simulated pace survives a week. */
  winProb: number;
  /** 0 to 1: how much their week moves with everyone else's. */
  correlation: number;
  /** Share of past weeks they took each board rank, safest first. */
  rankShares: number[];
}

/**
 * Rank every played week's board safest-first and record where each player
 * sat on it.
 *
 * Ranks are what make correlation work: two players on the same ranks hold the
 * same games, so they can never finish a week apart. Past weeks' ranks are also
 * a player's tendencies: how often they take the safest game, the second, and
 * so on. Read in one pass for the whole season rather than week by week, so the
 * database wakes once.
 */
async function readBoards(season: number, currentWeek: number) {
  const seasonGames = await db.query.games.findMany({
    where: eq(games.season, season),
  }).catch(() => []);

  const lines = await db.query.gameOdds.findMany({
    where: eq(gameOdds.season, season),
  }).catch(() => []);
  const linesByGame = new Map(lines.map(l => [Number(l.gameId), l]));

  // Same rule as the stats: nobody's ticket counts until the week kicks off.
  const now = Date.now();
  const startedWeeks = new Set(
    seasonGames.filter(g => new Date(g.startTime as any).getTime() <= now).map(g => g.week)
  );
  const seasonPicks = (await db.query.picks.findMany({
    where: eq(picks.season, season),
  }).catch(() => [])).filter(p => startedWeeks.has(p.week));

  const boardFor = (week: number) => {
    const priced = seasonGames
      .filter(g => g.week === week)
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

    // Only count a pick as taking the board position if they backed the
    // favourite; siding with a dog is a different bet than that rank represents.
    const ranksByUser = new Map<number, number[]>();
    for (const pick of seasonPicks) {
      if (pick.week !== week) continue;
      const rank = rankByGame.get(Number(pick.gameId));
      if (rank === undefined) continue;
      if (!isSameTeam(priced[rank].favourite, pick.pickedTeam)) continue;

      const existing = ranksByUser.get(pick.userId as number) ?? [];
      existing.push(rank);
      ranksByUser.set(pick.userId as number, existing);
    }

    return { probabilities: priced.map(g => g.probability), ranksByUser };
  };

  // Each player's ranks in every week they played before this one.
  const history = new Map<number, number[][]>();
  for (const week of Array.from(startedWeeks).filter(w => w < currentWeek).sort((a, b) => a - b)) {
    boardFor(week).ranksByUser.forEach((ranks, userId) => {
      history.set(userId, [...(history.get(userId) ?? []), ranks]);
    });
  }

  return { ...boardFor(currentWeek), history };
}

export async function computeTitleOdds(season: number, currentWeek: number) {
  const insights = await getSeasonInsights(season, currentWeek);
  const remainingWeeks = Math.max(0, 18 - currentWeek);
  const board = await readBoards(season, currentWeek);

  // No lines stored yet: fall back to a flat board so the card still renders.
  const probabilities = board.probabilities.length > 0
    ? board.probabilities
    : Array.from({ length: 8 }, () => 0.65);

  const curve = evCurve(probabilities, 8);
  const evLocks = bestLockCount(curve);

  // Pace is regressed toward the league average, because an observed pace is
  // mostly noise early on: after one week a single-lock ticket would otherwise
  // read as a season-long strategy and bury whatever that player has scored.
  const observed = insights.players.filter(p => p.activeWeeks > 0);
  const leaguePace = observed.length > 0
    ? observed.reduce((sum, p) => sum + p.avgPicksPerWeek, 0) / observed.length
    : 3;

  const paceOf = (p: typeof insights.players[0]) =>
    Math.max(1, Math.round(smoothedPace(p.avgPicksPerWeek || leaguePace, leaguePace, p.activeWeeks)));

  const survivalFor = (size: number) => {
    const clamped = Math.max(1, Math.min(curve.length, size));
    return (curve[clamped - 1]?.probability ?? 0) / 100;
  };

  /**
   * How tightly a player moves with the field.
   *
   * Someone on the chalk rises and falls with everyone else on the chalk; the
   * further their actual picks stray from the favourites, the more their week
   * is their own. Measured from the ticket they really hold, so it is observed
   * rather than assumed.
   */
  const correlationFor = (userId: number, size: number) => {
    const held = board.ranksByUser.get(userId);
    if (!held || held.length === 0) return FIELD_CORRELATION;

    const chalk = new Set(consensusRanks(size));
    const shared = held.filter(rank => chalk.has(rank)).length;
    return FIELD_CORRELATION * (shared / Math.max(held.length, size));
  };

  // Which games someone takes in week 12 is unknowable, so future weeks run at
  // their smoothed size against the chalk, partly correlated with everyone
  // else. Replaying this week's exact ticket seventeen times would compound one
  // week of noise into a season-long verdict, and make players on identical
  // tickets permanently inseparable.
  const seasonPlayers: SeasonPlayer[] = insights.players.map(p => {
    const size = paceOf(p);
    return {
      userId: p.userId,
      points: p.totalPoints,
      size,
      winProb: survivalFor(size),
      correlation: correlationFor(p.userId, size),
    };
  });

  const odds = seasonTitleOdds(seasonPlayers, remainingWeeks, RUNS, makeRng(SEED));
  const finishes = seasonProjection(seasonPlayers, remainingWeeks, RUNS, makeRng(SEED));

  const rows: PlayerOddsResult[] = insights.players.map((p, i) => {
    const bestOther = Math.max(
      0,
      ...insights.players.filter(r => r.userId !== p.userId).map(r => r.totalPoints)
    );

    return {
      userId: p.userId,
      name: p.name,
      points: p.totalPoints,
      margin: p.totalPoints - bestOther,
      avgPicksPerWeek: p.avgPicksPerWeek,
      simulatedPace: paceOf(p),
      projectedPoints: p.projectedPoints,
      maxCeiling: p.maxCeiling,
      odds: odds.get(p.userId) ?? 0,
      projectedFinish: finishes.get(p.userId) ?? p.totalPoints,
      winProb: seasonPlayers[i].winProb,
      correlation: seasonPlayers[i].correlation,
      rankShares: rankShares(board.history.get(p.userId) ?? []),
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
    par: HISTORICAL_PAR,
    odds: rows.sort((a, b) => b.odds - a.odds),
  };
}
