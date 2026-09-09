import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getSeasonInsights } from './insights';

type LeaderRow = { userId: number; name: string; points: number };

export async function getLeaderboardTotals(season: number): Promise<LeaderRow[]> {
  const rows = await db.execute<LeaderRow>(sql`
    SELECT u.id AS "userId", u.name AS "name", COALESCE(SUM(ws.points), 0)::int AS "points"
    FROM users u
    LEFT JOIN weeklyscores ws
      ON ws.userid = u.id AND ws.season = ${season}
    GROUP BY u.id, u.name
    ORDER BY "points" DESC, u.name ASC
  `);
  const list = (rows as any)?.rows || (Array.isArray(rows) ? rows : []);
  return list;
}

// Fallback estimation if needed
export async function getAvgPicksPerWeek(season: number, currentWeek: number): Promise<number> {
  if (!currentWeek || currentWeek <= 1) return 3;
  const res = await db.execute<{ total: number; users: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM picks WHERE season = ${season} AND week <= ${currentWeek})::int AS total,
      (SELECT COUNT(*) FROM users)::int AS users
  `);
  const first = (res as any)?.rows?.[0] || (Array.isArray(res) ? res[0] : null);
  const total = first?.total ?? 0;
  const users = Math.max(1, first?.users ?? 1);
  const finishedWeeks = Math.max(1, currentWeek);
  const avg = total / (users * finishedWeeks);
  return Math.min(6, Math.max(1, Number.isFinite(avg) ? avg : 3));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export interface PlayerOddsResult {
  userId: number;
  name: string;
  points: number;
  margin: number;
  odds: number;
  avgPicksPerWeek: number;
  projectedPoints: number;
  maxCeiling: number;
}

export async function computeTitleOdds(season: number, currentWeek: number) {
  const insights = await getSeasonInsights(season, currentWeek);
  const remainingWeeks = Math.max(0, 18 - currentWeek);
  
  // Calculate personalized pace for each user from actual data
  const playerMap = new Map<number, typeof insights.players[0]>();
  for (const p of insights.players) {
    playerMap.set(p.userId, p);
  }

  const leaders = insights.players.map(p => ({
    userId: p.userId,
    name: p.name,
    points: p.totalPoints,
    avgPicks: p.avgPicksPerWeek || 3,
    projectedPoints: p.projectedPoints,
    maxCeiling: p.maxCeiling,
    pickWinPct: p.pickWinPct,
  }));

  const maxPoints = Math.max(0, ...leaders.map(l => l.points));
  
  // Overall league average for baseline reference
  const validAvgs = leaders.filter(l => l.avgPicks > 0).map(l => l.avgPicks);
  const leagueAvgPicks = validAvgs.length > 0
    ? Number((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length).toFixed(1))
    : 3;

  // Title odds computed using each person's actual pace and points gap
  const raw = leaders.map((row) => {
    const bestOther = Math.max(
      0,
      ...leaders.filter((r) => r.userId !== row.userId).map((r) => r.points)
    );
    const margin = row.points - bestOther;

    // Person's remaining potential points based on their own actual pace
    const personSwing = Math.max(1, remainingWeeks * row.avgPicks);

    // Scaling factor: larger swing allows comebacks; smaller personal swing penalizes deficits
    const K = 3.5;
    const score = logistic((K * margin) / personSwing);

    // Boost score slightly if player has a higher projected final score
    const projectedWeight = Math.max(0.1, (row.projectedPoints + 1) / (maxPoints + (remainingWeeks * leagueAvgPicks * 0.3) + 1));
    const finalScore = score * Math.pow(projectedWeight, 0.5);

    return {
      userId: row.userId,
      name: row.name,
      points: row.points,
      margin,
      avgPicksPerWeek: row.avgPicks,
      projectedPoints: row.projectedPoints,
      maxCeiling: row.maxCeiling,
      score: Math.max(0.001, finalScore),
    };
  });

  const sum = raw.reduce((a, b) => a + b.score, 0) || 1;
  const withPct: PlayerOddsResult[] = raw.map((r) => ({
    userId: r.userId,
    name: r.name,
    points: r.points,
    margin: r.margin,
    avgPicksPerWeek: r.avgPicksPerWeek,
    projectedPoints: r.projectedPoints,
    maxCeiling: r.maxCeiling,
    odds: Number(((r.score / sum) * 100).toFixed(1)),
  }));

  return {
    season,
    week: currentWeek,
    remainingWeeks,
    avgPicksPerWeek: leagueAvgPicks,
    odds: withPct.sort((a, b) => b.odds - a.odds),
  };
}
