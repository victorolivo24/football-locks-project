import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { isSameTeam, normalizeTeam } from './teams';

export interface PlayerInsights {
  userId: number;
  name: string;
  totalPoints: number;
  totalPicks: number;
  activeWeeks: number;
  avgPicksPerWeek: number;
  homePicks: number;
  awayPicks: number;
  homePct: number;
  awayPct: number;
  homeTendency: 'Home Favored' | 'Road Favored' | 'Balanced';
  primeTimePicks: number;
  primeTimePct: number;
  primeTimeCompleted: number;
  primeTimeWins: number;
  primeTimeWinPct: number;
  completedPicks: number;
  correctPicks: number;
  pickWinPct: number;
  perfectWeeks: number;
  perfectWeekPct: number;
  maxWeekScore: number;
  topTeams: Array<{ team: string; count: number }>;
  projectedPoints: number;
  maxCeiling: number;
  weeklyPicksBreakdown: Record<number, number>;
}

export interface LeagueSuperlative {
  title: string;
  icon: string;
  playerName: string;
  stat: string;
  description: string;
}

export interface SeasonInsightsData {
  season: number;
  currentWeek: number;
  remainingWeeks: number;
  players: PlayerInsights[];
  superlatives: LeagueSuperlative[];
}

/**
 * Determine whether an NFL game is considered Prime Time:
 * - Kickoff at 7:00 PM Eastern (19:00) or later (Thursday Night, Sunday Night, Monday Night, etc.)
 * - Or Thursday / Monday games starting at 6:00 PM ET or later
 */
export function isPrimeTimeGame(startTime: Date | string): boolean {
  if (!startTime) return false;
  const dt = typeof startTime === 'string'
    ? DateTime.fromISO(startTime).setZone('America/New_York')
    : DateTime.fromJSDate(new Date(startTime)).setZone('America/New_York');

  if (!dt.isValid) return false;

  // In America/New_York:
  // Thursday = 4, Monday = 1, Sunday = 7
  if (dt.hour >= 19) return true; // Standard 7 PM+ kickoff
  if ((dt.weekday === 4 || dt.weekday === 1) && dt.hour >= 18) return true;
  return false;
}

export async function getSeasonInsights(season: number, currentWeekOverride?: number): Promise<SeasonInsightsData> {
  // 1. Fetch all users
  const allUsers = await db.query.users.findMany({
    orderBy: (users, { asc }) => [asc(users.name)],
  });

  // 2. Fetch games for this season
  const seasonGames = await db.query.games.findMany({
    where: (games, { eq }) => eq(games.season, season),
    orderBy: (games, { asc }) => [asc(games.startTime)],
  });

  // 3. Fetch picks for this season
  const seasonPicks = await db.query.picks.findMany({
    where: (picks, { eq }) => eq(picks.season, season),
  });

  // 4. Fetch weekly scores for this season
  const seasonScores = await db.query.weeklyScores.findMany({
    where: (weeklyScores, { eq }) => eq(weeklyScores.season, season),
  });

  // Determine active/max week
  const weeksWithPicks = seasonPicks.map(p => p.week);
  const maxWeekInPicks = weeksWithPicks.length > 0 ? Math.max(...weeksWithPicks) : 1;
  const currentWeek = currentWeekOverride || Math.max(1, maxWeekInPicks);
  const remainingWeeks = Math.max(0, 18 - currentWeek);

  const gameMap = new Map<number, typeof seasonGames[0]>();
  for (const g of seasonGames) {
    gameMap.set(Number(g.id), g);
  }

  // Calculate league average picks per active week as baseline fallback
  let leagueTotalPicks = 0;
  let leagueTotalActiveWeeks = 0;

  const playerStatsMap = new Map<number, PlayerInsights>();

  for (const user of allUsers) {
    const userPicks = seasonPicks.filter(p => p.userId === user.id);
    const userScores = seasonScores.filter(s => s.userId === user.id);
    const totalPoints = userScores.reduce((sum, s) => sum + s.points, 0);

    const weeklyBreakdown: Record<number, number> = {};
    for (const p of userPicks) {
      weeklyBreakdown[p.week] = (weeklyBreakdown[p.week] || 0) + 1;
    }

    const activeWeeks = Object.keys(weeklyBreakdown).length;
    const totalPicks = userPicks.length;
    leagueTotalPicks += totalPicks;
    leagueTotalActiveWeeks += activeWeeks;

    let homePicks = 0;
    let awayPicks = 0;
    let primeTimePicks = 0;
    let primeTimeCompleted = 0;
    let primeTimeWins = 0;
    let completedPicks = 0;
    let correctPicks = 0;

    const teamCounts: Record<string, number> = {};

    for (const p of userPicks) {
      const g = gameMap.get(Number(p.gameId)) ||
        seasonGames.find(sg => sg.week === p.week && (isSameTeam(sg.homeTeam, p.pickedTeam) || isSameTeam(sg.awayTeam, p.pickedTeam)));

      const normPicked = normalizeTeam(p.pickedTeam);
      teamCounts[normPicked] = (teamCounts[normPicked] || 0) + 1;

      if (g) {
        const isHome = isSameTeam(p.pickedTeam, g.homeTeam);
        const isAway = isSameTeam(p.pickedTeam, g.awayTeam);
        if (isHome) homePicks++;
        else if (isAway) awayPicks++;

        const isPrime = isPrimeTimeGame(g.startTime);
        if (isPrime) primeTimePicks++;

        if (g.status === 'final' && g.winnerTeam) {
          completedPicks++;
          const hit = isSameTeam(g.winnerTeam, p.pickedTeam);
          if (hit) correctPicks++;

          if (isPrime) {
            primeTimeCompleted++;
            if (hit) primeTimeWins++;
          }
        }
      }
    }

    const avgPicksPerWeek = activeWeeks > 0 ? Number((totalPicks / activeWeeks).toFixed(1)) : 3;

    const homePct = totalPicks > 0 ? Math.round((homePicks / totalPicks) * 100) : 50;
    const awayPct = totalPicks > 0 ? 100 - homePct : 50;
    const homeTendency = homePct >= 60 ? 'Home Favored' : awayPct >= 60 ? 'Road Favored' : 'Balanced';

    const primeTimePct = totalPicks > 0 ? Math.round((primeTimePicks / totalPicks) * 100) : 0;
    const primeTimeWinPct = primeTimeCompleted > 0 ? Math.round((primeTimeWins / primeTimeCompleted) * 100) : 0;

    const pickWinPct = completedPicks > 0 ? Math.round((correctPicks / completedPicks) * 100) : 0;

    const perfectWeeks = userScores.filter(s => s.points > 0).length;
    const perfectWeekPct = activeWeeks > 0 ? Math.round((perfectWeeks / activeWeeks) * 100) : 0;

    const maxWeekScore = userScores.length > 0 ? Math.max(...userScores.map(s => s.points)) : 0;

    const sortedTeams = Object.entries(teamCounts)
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count);

    // Personalized projections:
    // Max ceiling = currentPoints + (remainingWeeks * avgPicksPerWeek)
    const maxCeiling = totalPoints + Math.round(remainingWeeks * avgPicksPerWeek);

    // Expected weekly points calculation based on hit rate:
    // In all-or-nothing: if picking n games with accuracy p, P(all correct) = p^n, expected pts/wk = n * p^n
    // If no completed picks yet, default to historical baseline p = 0.65
    const hitRateDec = completedPicks >= 3 ? (correctPicks / completedPicks) : 0.65;
    const expWinWeekProb = Math.pow(Math.max(0.2, Math.min(0.95, hitRateDec)), avgPicksPerWeek);
    const expPtsPerWeek = avgPicksPerWeek * expWinWeekProb;
    const projectedPoints = Number((totalPoints + (remainingWeeks * expPtsPerWeek)).toFixed(1));

    playerStatsMap.set(user.id, {
      userId: user.id,
      name: user.name,
      totalPoints,
      totalPicks,
      activeWeeks,
      avgPicksPerWeek,
      homePicks,
      awayPicks,
      homePct,
      awayPct,
      homeTendency,
      primeTimePicks,
      primeTimePct,
      primeTimeCompleted,
      primeTimeWins,
      primeTimeWinPct,
      completedPicks,
      correctPicks,
      pickWinPct,
      perfectWeeks,
      perfectWeekPct,
      maxWeekScore,
      topTeams: sortedTeams.slice(0, 3),
      projectedPoints,
      maxCeiling,
      weeklyPicksBreakdown: weeklyBreakdown,
    });
  }

  const players = Array.from(playerStatsMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.pickWinPct - a.pickWinPct;
  });

  // Calculate League Superlatives
  const superlatives: LeagueSuperlative[] = [];

  // 1. Most Aggressive Lock Picker (highest avg picks/week, with at least 1 pick)
  const pickVolumeLeader = [...players].filter(p => p.totalPicks > 0).sort((a, b) => b.avgPicksPerWeek - a.avgPicksPerWeek)[0];
  if (pickVolumeLeader && pickVolumeLeader.avgPicksPerWeek > 0) {
    superlatives.push({
      title: 'High Roller',
      icon: '🎰',
      playerName: pickVolumeLeader.name,
      stat: `${pickVolumeLeader.avgPicksPerWeek} picks/wk`,
      description: 'Laying the most locks on the line each week',
    });
  }

  // 2. Conservative / Surgical Picker (lowest avg picks/week >= 1)
  const conservativePicker = [...players].filter(p => p.totalPicks > 0).sort((a, b) => a.avgPicksPerWeek - b.avgPicksPerWeek)[0];
  if (conservativePicker && conservativePicker.userId !== pickVolumeLeader?.userId) {
    superlatives.push({
      title: 'Sniper',
      icon: '🎯',
      playerName: conservativePicker.name,
      stat: `${conservativePicker.avgPicksPerWeek} picks/wk`,
      description: 'Ultra-selective, quality-over-quantity approach',
    });
  }

  // 3. Homefield Believer (highest home %)
  const homeAdvocate = [...players].filter(p => p.totalPicks >= 2).sort((a, b) => b.homePct - a.homePct)[0];
  if (homeAdvocate && homeAdvocate.homePct >= 50) {
    superlatives.push({
      title: 'Home Turf Faithful',
      icon: '🏠',
      playerName: homeAdvocate.name,
      stat: `${homeAdvocate.homePct}% Home`,
      description: 'Prefers the home crowd advantage',
    });
  }

  // 4. Prime Time Junkie (highest prime time %)
  const primeTimeLeader = [...players].filter(p => p.totalPicks >= 2).sort((a, b) => b.primeTimePct - a.primeTimePct)[0];
  if (primeTimeLeader && primeTimeLeader.primeTimePct > 0) {
    superlatives.push({
      title: 'Prime Time Junkie',
      icon: '🌙',
      playerName: primeTimeLeader.name,
      stat: `${primeTimeLeader.primeTimePct}% Night`,
      description: 'Can’t resist locking in under the bright lights',
    });
  }

  // 5. Most Accurate Locksmith (highest pick win rate with at least 3 completed picks)
  const accuracyLeader = [...players].filter(p => p.completedPicks >= 2).sort((a, b) => b.pickWinPct - a.pickWinPct)[0];
  if (accuracyLeader) {
    superlatives.push({
      title: 'Top Locksmith',
      icon: '🔒',
      playerName: accuracyLeader.name,
      stat: `${accuracyLeader.pickWinPct}% Hits`,
      description: `${accuracyLeader.correctPicks}/${accuracyLeader.completedPicks} individual locks cashed`,
    });
  }

  return {
    season,
    currentWeek,
    remainingWeeks,
    players,
    superlatives,
  };
}
