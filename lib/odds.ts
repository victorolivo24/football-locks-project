import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

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
  return rows.rows;
}

// Estimate average picks per week from data so far. Fallback to 3.
export async function getAvgPicksPerWeek(season: number, currentWeek: number): Promise<number> {
  if (!currentWeek || currentWeek <= 1) return 3;
  const res = await db.execute<{ total: number; users: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM picks WHERE season = ${season} AND week <= ${currentWeek})::int AS total,
      (SELECT COUNT(*) FROM users)::int AS users
  `);
  const total = res.rows[0]?.total ?? 0;
  const users = Math.max(1, res.rows[0]?.users ?? 1);
  const finishedWeeks = Math.max(1, currentWeek);
  const avg = total / (users * finishedWeeks);
  return Math.min(6, Math.max(1, Number.isFinite(avg) ? avg : 3));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export async function computeTitleOdds(season: number, currentWeek: number) {
  const leaders = await getLeaderboardTotals(season);
  const remainingWeeks = Math.max(0, 18 - currentWeek + 1);
  const avgPicks = await getAvgPicksPerWeek(season, currentWeek);
  const maxSwing = Math.max(0.001, remainingWeeks * avgPicks); // epsilon to avoid divide-by-zero

  const K = 3; // scaling factor for steepness
  const raw = leaders.map((row) => {
    const bestOther = Math.max(
      0,
      ...leaders.filter((r) => r.userId !== row.userId).map((r) => r.points)
    );
    const margin = row.points - bestOther;
    const score = logistic((K * margin) / maxSwing);
    return { ...row, margin, score };
  });

  const sum = raw.reduce((a, b) => a + b.score, 0) || 1;
  const withPct = raw.map((r) => ({
    userId: r.userId,
    name: r.name,
    points: r.points,
    margin: r.margin,
    odds: (r.score / sum) * 100,
  }));

  return {
    season,
    week: currentWeek,
    remainingWeeks,
    avgPicksPerWeek: avgPicks,
    maxSwing,
    odds: withPct.sort((a, b) => b.odds - a.odds),
  };
}

