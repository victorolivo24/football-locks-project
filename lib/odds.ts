import { getSeasonInsights } from './insights';

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
