import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { isSameTeam, normalizeTeam } from './teams';

export interface HeartbreakStats {
  heartbreakWeeks: number; // Number of weeks with exactly 1 loss (and >= 2 picks)
  pointsLostToHeartbreak: number; // Sum of potential points from those 1-miss weeks
  worstHeartbreak?: {
    week: number;
    record: string; // e.g. "5 of 6"
    potentialPoints: number;
    spoilerTeam: string;
  } | null;
}

export interface OptimalPicksStats {
  effectiveHitRate: number; // In percentage (e.g. 72)
  optimalPicks: number; // Recommended number of picks per week (e.g. 3)
  optimalEV: number; // Expected points per week if picking optimal number
  currentEV: number; // Expected points per week at current pace
  strategyVerdict: 'Optimal' | 'Lottery Hunter' | 'Conservative';
  evDifference: number; // optimalEV - currentEV
  advice: string;
}

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
  heartbreak: HeartbreakStats;
  optimalStrategy: OptimalPicksStats;
}

export interface SlateBusterTeam {
  team: string;
  lossesCaused: number; // Number of player locks on this team that lost
  victims: string[]; // Names of players who lost with this team
  pointsRuined: number; // Estimated points lost by tickets containing this team
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
  slateBusters: SlateBusterTeam[];
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

  if (dt.hour >= 19) return true;
  if ((dt.weekday === 4 || dt.weekday === 1) && dt.hour >= 18) return true;
  return false;
}

/**
 * Game Theory: Calculate optimal number of locks N in all-or-nothing scoring
 * EV(N) = N * (p ^ N)
 */
export function calculateOptimalPicks(
  rawHitRate: number,
  totalCompletedPicks: number,
  currentAvgPicks: number
): OptimalPicksStats {
  // Empirical Bayes smoothing: regress towards 65% baseline if low sample size
  const priorRate = 0.65;
  const priorWeight = 6; // Equivalent to 6 previous games of prior
  const smoothedRate = totalCompletedPicks > 0
    ? ((rawHitRate / 100) * totalCompletedPicks + priorRate * priorWeight) / (totalCompletedPicks + priorWeight)
    : priorRate;

  const p = Math.max(0.35, Math.min(0.95, smoothedRate));
  const hitRatePct = Math.round(p * 100);

  // Evaluate N from 1 to 8
  let bestN = 1;
  let maxEV = -1;
  const evMap: Record<number, number> = {};

  for (let n = 1; n <= 8; n++) {
    const ev = n * Math.pow(p, n);
    evMap[n] = ev;
    if (ev > maxEV) {
      maxEV = ev;
      bestN = n;
    }
  }

  const roundedCurrentPicks = Math.max(1, Math.min(8, Math.round(currentAvgPicks)));
  const currentEV = evMap[roundedCurrentPicks] ?? (currentAvgPicks * Math.pow(p, currentAvgPicks));
  const diff = Number((maxEV - currentEV).toFixed(2));

  let strategyVerdict: 'Optimal' | 'Lottery Hunter' | 'Conservative' = 'Optimal';
  let advice = `Picking ${bestN} locks per week maximizes your expected weekly points (${maxEV.toFixed(2)} pts/wk).`;

  if (currentAvgPicks >= bestN + 1.2) {
    strategyVerdict = 'Lottery Hunter';
    advice = `You're picking ${currentAvgPicks.toFixed(1)} locks/wk, but with a ${hitRatePct}% hit rate, dialling down to ${bestN} locks would increase your expected payout from ${currentEV.toFixed(2)} to ${maxEV.toFixed(2)} pts/wk.`;
  } else if (currentAvgPicks <= bestN - 1.2) {
    strategyVerdict = 'Conservative';
    advice = `You're currently playing it safe at ${currentAvgPicks.toFixed(1)} locks/wk. With your ${hitRatePct}% accuracy, bumping up to ${bestN} locks would maximize your point pace.`;
  } else {
    strategyVerdict = 'Optimal';
    advice = `You are dialed into the mathematical sweet spot! Picking ~${bestN} locks per week maximizes your long-term title equity.`;
  }

  return {
    effectiveHitRate: hitRatePct,
    optimalPicks: bestN,
    optimalEV: Number(maxEV.toFixed(2)),
    currentEV: Number(currentEV.toFixed(2)),
    strategyVerdict,
    evDifference: Math.max(0, diff),
    advice,
  };
}

export async function getSeasonInsights(season: number, currentWeekOverride?: number): Promise<SeasonInsightsData> {
  const allUsers = await db.query.users.findMany({
    orderBy: (users, { asc }) => [asc(users.name)],
  });

  const seasonGames = await db.query.games.findMany({
    where: (games, { eq }) => eq(games.season, season),
    orderBy: (games, { asc }) => [asc(games.startTime)],
  });

  const seasonPicks = await db.query.picks.findMany({
    where: (picks, { eq }) => eq(picks.season, season),
  });

  const seasonScores = await db.query.weeklyScores.findMany({
    where: (weeklyScores, { eq }) => eq(weeklyScores.season, season),
  });

  const weeksWithPicks = seasonPicks.map(p => p.week);
  const maxWeekInPicks = weeksWithPicks.length > 0 ? Math.max(...weeksWithPicks) : 1;
  const currentWeek = currentWeekOverride || Math.max(1, maxWeekInPicks);
  const remainingWeeks = Math.max(0, 18 - currentWeek);

  const gameMap = new Map<number, typeof seasonGames[0]>();
  for (const g of seasonGames) {
    gameMap.set(Number(g.id), g);
  }

  // Slate busters tracker: map team -> losses caused
  const slateBusterMap = new Map<string, { lossesCaused: number; victims: Set<string>; pointsRuined: number }>();

  const playerStatsMap = new Map<number, PlayerInsights>();

  for (const user of allUsers) {
    const userPicks = seasonPicks.filter(p => p.userId === user.id);
    const userScores = seasonScores.filter(s => s.userId === user.id);
    const totalPoints = userScores.reduce((sum, s) => sum + s.points, 0);

    const weeklyPicksMap: Record<number, typeof userPicks> = {};
    for (const p of userPicks) {
      if (!weeklyPicksMap[p.week]) weeklyPicksMap[p.week] = [];
      weeklyPicksMap[p.week].push(p);
    }

    const activeWeeks = Object.keys(weeklyPicksMap).length;
    const totalPicks = userPicks.length;

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
          if (hit) {
            correctPicks++;
          } else {
            // Pick LOST! Track as slate buster
            const existingBuster = slateBusterMap.get(normPicked) || {
              lossesCaused: 0,
              victims: new Set<string>(),
              pointsRuined: 0,
            };
            existingBuster.lossesCaused++;
            existingBuster.victims.add(user.name);
            existingBuster.pointsRuined += (weeklyPicksMap[p.week]?.length || 3);
            slateBusterMap.set(normPicked, existingBuster);
          }

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

    // Heartbreak Index Calculation:
    // Weeks with >= 2 picks where user got EXACTLY 1 pick wrong
    let heartbreakWeeks = 0;
    let pointsLostToHeartbreak = 0;
    let worstHeartbreak: HeartbreakStats['worstHeartbreak'] = null;

    for (const [wStr, picksForWeek] of Object.entries(weeklyPicksMap)) {
      const weekNum = Number(wStr);
      if (picksForWeek.length < 2) continue;

      let weekFinals = 0;
      let weekLosses = 0;
      let spoilerTeam = '';

      for (const p of picksForWeek) {
        const g = gameMap.get(Number(p.gameId)) ||
          seasonGames.find(sg => sg.week === weekNum && (isSameTeam(sg.homeTeam, p.pickedTeam) || isSameTeam(sg.awayTeam, p.pickedTeam)));

        if (g && g.status === 'final' && g.winnerTeam) {
          weekFinals++;
          if (!isSameTeam(g.winnerTeam, p.pickedTeam)) {
            weekLosses++;
            spoilerTeam = normalizeTeam(p.pickedTeam);
          }
        }
      }

      // If all games are completed and exactly 1 loss
      if (weekFinals === picksForWeek.length && weekLosses === 1) {
        heartbreakWeeks++;
        const ptsLost = picksForWeek.length;
        pointsLostToHeartbreak += ptsLost;

        if (!worstHeartbreak || ptsLost > worstHeartbreak.potentialPoints) {
          worstHeartbreak = {
            week: weekNum,
            record: `${picksForWeek.length - 1} of ${picksForWeek.length}`,
            potentialPoints: ptsLost,
            spoilerTeam: spoilerTeam || 'Unknown',
          };
        }
      }
    }

    // Optimal Picks Game Theory Engine
    const optimalStrategy = calculateOptimalPicks(pickWinPct, completedPicks, avgPicksPerWeek);

    const sortedTeams = Object.entries(teamCounts)
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count);

    const maxCeiling = totalPoints + Math.round(remainingWeeks * avgPicksPerWeek);
    const expWinWeekProb = Math.pow(optimalStrategy.effectiveHitRate / 100, avgPicksPerWeek);
    const expPtsPerWeek = avgPicksPerWeek * expWinWeekProb;
    const projectedPoints = Number((totalPoints + (remainingWeeks * expPtsPerWeek)).toFixed(1));

    const weeklyCounts: Record<number, number> = {};
    for (const [w, picks] of Object.entries(weeklyPicksMap)) {
      weeklyCounts[Number(w)] = picks.length;
    }

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
      weeklyPicksBreakdown: weeklyCounts,
      heartbreak: {
        heartbreakWeeks,
        pointsLostToHeartbreak,
        worstHeartbreak,
      },
      optimalStrategy,
    });
  }

  const players = Array.from(playerStatsMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.pickWinPct - a.pickWinPct;
  });

  // Slate Busters ranked
  const slateBusters: SlateBusterTeam[] = Array.from(slateBusterMap.entries())
    .map(([team, data]) => ({
      team,
      lossesCaused: data.lossesCaused,
      victims: Array.from(data.victims),
      pointsRuined: data.pointsRuined,
    }))
    .sort((a, b) => b.lossesCaused - a.lossesCaused);

  // League Superlatives
  const superlatives: LeagueSuperlative[] = [];

  // 1. High Roller
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

  // 2. Heartbreak King (most 1-pick heartbreak weeks or points lost)
  const heartbreakKing = [...players].sort((a, b) => b.heartbreak.pointsLostToHeartbreak - a.heartbreak.pointsLostToHeartbreak)[0];
  if (heartbreakKing && heartbreakKing.heartbreak.heartbreakWeeks > 0) {
    superlatives.push({
      title: 'Heartbreak King',
      icon: '💔',
      playerName: heartbreakKing.name,
      stat: `-${heartbreakKing.heartbreak.pointsLostToHeartbreak} pts`,
      description: `${heartbreakKing.heartbreak.heartbreakWeeks} slate(s) ruined by just 1 wrong lock`,
    });
  }

  // 3. Mathematical Genius / Optimal Picker
  const optimalMaster = [...players].filter(p => p.totalPicks > 0).sort((a, b) => a.optimalStrategy.evDifference - b.optimalStrategy.evDifference)[0];
  if (optimalMaster) {
    superlatives.push({
      title: 'Game Theorist',
      icon: '🧮',
      playerName: optimalMaster.name,
      stat: `${optimalMaster.avgPicksPerWeek.toFixed(1)} / ${optimalMaster.optimalStrategy.optimalPicks} opt`,
      description: 'Closest to mathematical EV-maximizing volume',
    });
  }

  // 4. Prime Time Junkie
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

  // 5. Home Turf Faithful
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

  return {
    season,
    currentWeek,
    remainingWeeks,
    players,
    superlatives,
    slateBusters,
  };
}
