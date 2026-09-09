import { db } from '@/lib/db';
import { DateTime } from 'luxon';
import { isSameTeam, normalizeTeam } from './teams';
import { fairWinProbability, ticketProbability, expectedPoints } from './luck';
import { pickKey, similarity, sharedCount } from './overlap';

export interface LuckLedger {
  expectedPoints: number; // What the market said the tickets were worth
  actualPoints: number; // What was actually scored over those same weeks
  delta: number; // actual - expected: positive is running hot
  gradedWeeks: number; // Weeks counted (fully priced and fully played)
  weeks: Array<{
    week: number;
    locks: number;
    probability: number; // Chance the ticket survived, as a percentage
    expected: number;
    actual: number;
  }>;
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
  optimalStrategy: OptimalPicksStats;
  luck: LuckLedger;
}

export interface LeagueSuperlative {
  title: string;
  icon: string;
  playerName: string;
  stat: string;
  description: string;
}

export interface TeamLedgerRow {
  team: string;
  locked: number; // Times this team was locked league-wide
  hits: number;
  misses: number;
  hitRate: number; // Percentage
  expectedHits: number; // What the closing lines said to expect
  edge: number; // hits - expectedHits; positive means the team beat its price
  victims: string[]; // Who it burned
}

export interface OverlapPair {
  a: string;
  b: string;
  shared: number; // Identical picks
  similarity: number; // Percentage of their combined picks that match
}

export interface SeasonInsightsData {
  season: number;
  currentWeek: number;
  remainingWeeks: number;
  players: PlayerInsights[];
  superlatives: LeagueSuperlative[];
  teamLedger: TeamLedgerRow[];
  overlap: OverlapPair[];
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

/**
 * Score a player's season against what the market said their tickets were worth.
 *
 * Only weeks that are both fully priced and fully played are graded, so the
 * comparison is like for like: an unpriced leg would understate expectation,
 * and an unfinished week has no actual score to compare against yet.
 */
function buildLuckLedger(
  weeklyPicksMap: Record<number, Array<{ gameId: number | null; pickedTeam: string }>>,
  gameMap: Map<number, { homeTeam: string; awayTeam: string; status: string; winnerTeam: string | null }>,
  oddsByGame: Map<number, { homeMoneyline: number | null; awayMoneyline: number | null }>,
  userScores: Array<{ week: number; points: number }>
): LuckLedger {
  const weeks: LuckLedger['weeks'] = [];

  for (const [weekStr, picksForWeek] of Object.entries(weeklyPicksMap)) {
    const week = Number(weekStr);
    const legProbabilities: number[] = [];
    let gradable = true;

    for (const pick of picksForWeek) {
      const game = gameMap.get(Number(pick.gameId));
      const line = oddsByGame.get(Number(pick.gameId));

      if (!game || game.status !== 'final' || !line) {
        gradable = false;
        break;
      }

      const pickedHome = isSameTeam(pick.pickedTeam, game.homeTeam);
      const pickedOdds = pickedHome ? line.homeMoneyline : line.awayMoneyline;
      const opponentOdds = pickedHome ? line.awayMoneyline : line.homeMoneyline;

      if (pickedOdds == null || opponentOdds == null) {
        gradable = false;
        break;
      }

      legProbabilities.push(fairWinProbability(pickedOdds, opponentOdds));
    }

    if (!gradable || legProbabilities.length === 0) continue;

    weeks.push({
      week,
      locks: picksForWeek.length,
      probability: Number((ticketProbability(legProbabilities) * 100).toFixed(1)),
      expected: Number(expectedPoints(legProbabilities).toFixed(2)),
      actual: userScores.find(s => s.week === week)?.points ?? 0,
    });
  }

  weeks.sort((a, b) => a.week - b.week);

  const expected = weeks.reduce((sum, w) => sum + w.expected, 0);
  const actual = weeks.reduce((sum, w) => sum + w.actual, 0);

  return {
    expectedPoints: Number(expected.toFixed(2)),
    actualPoints: actual,
    delta: Number((actual - expected).toFixed(2)),
    gradedWeeks: weeks.length,
    weeks,
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

  const seasonOdds = await db.query.gameOdds.findMany({
    where: (gameOdds, { eq }) => eq(gameOdds.season, season),
  }).catch(() => []);

  const oddsByGame = new Map(seasonOdds.map(o => [Number(o.gameId), o]));

  const weeksWithPicks = seasonPicks.map(p => p.week);
  const maxWeekInPicks = weeksWithPicks.length > 0 ? Math.max(...weeksWithPicks) : 1;
  const currentWeek = currentWeekOverride || Math.max(1, maxWeekInPicks);
  const remainingWeeks = Math.max(0, 18 - currentWeek);

  const gameMap = new Map<number, typeof seasonGames[0]>();
  for (const g of seasonGames) {
    gameMap.set(Number(g.id), g);
  }

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

        if (g.status === 'final') {
          completedPicks++;
          // A tie is a miss: the lock only hits if the picked team wins.
          const hit = !!g.winnerTeam && isSameTeam(g.winnerTeam, p.pickedTeam);
          if (hit) {
            correctPicks++;
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

    const luck = buildLuckLedger(weeklyPicksMap, gameMap, oddsByGame, userScores);

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
      optimalStrategy,
      luck,
    });
  }

  const players = Array.from(playerStatsMap.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.pickWinPct - a.pickWinPct;
  });

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

  // 2. The Locksmith (highest hit rate) or Road Warrior
  const accuracyLeader = [...players].filter(p => p.completedPicks >= 2).sort((a, b) => b.pickWinPct - a.pickWinPct)[0];
  if (accuracyLeader && accuracyLeader.completedPicks > 0) {
    superlatives.push({
      title: 'The Locksmith',
      icon: '🎯',
      playerName: accuracyLeader.name,
      stat: `${accuracyLeader.pickWinPct}% Hits`,
      description: 'Highest lock accuracy across completed games',
    });
  } else {
    const roadLeader = [...players].filter(p => p.totalPicks >= 2).sort((a, b) => b.awayPct - a.awayPct)[0];
    if (roadLeader && roadLeader.awayPct >= 30) {
      superlatives.push({
        title: 'Road Warrior',
        icon: '✈️',
        playerName: roadLeader.name,
        stat: `${roadLeader.awayPct}% Away`,
        description: 'Never afraid to back road travelers and underdogs',
      });
    }
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

  // Team ledger: how each locked team actually performed against its price.
  const teamLedgerMap = new Map<string, {
    locked: number; hits: number; misses: number; expectedHits: number; victims: Set<string>;
  }>();

  for (const pick of seasonPicks) {
    const game = gameMap.get(Number(pick.gameId));
    if (!game || game.status !== 'final') continue;

    const team = normalizeTeam(pick.pickedTeam);
    const row = teamLedgerMap.get(team) ?? {
      locked: 0, hits: 0, misses: 0, expectedHits: 0, victims: new Set<string>(),
    };

    row.locked++;
    const hit = !!game.winnerTeam && isSameTeam(game.winnerTeam, pick.pickedTeam);
    if (hit) {
      row.hits++;
    } else {
      row.misses++;
      const owner = allUsers.find(u => u.id === pick.userId);
      if (owner) row.victims.add(owner.name);
    }

    // Credit the team with the win probability its closing line implied, so a
    // favourite that holds serve reads as par rather than as a triumph.
    const line = oddsByGame.get(Number(pick.gameId));
    if (line?.homeMoneyline != null && line?.awayMoneyline != null) {
      const pickedHome = isSameTeam(pick.pickedTeam, game.homeTeam);
      row.expectedHits += fairWinProbability(
        pickedHome ? line.homeMoneyline : line.awayMoneyline,
        pickedHome ? line.awayMoneyline : line.homeMoneyline
      );
    }

    teamLedgerMap.set(team, row);
  }

  const teamLedger: TeamLedgerRow[] = Array.from(teamLedgerMap.entries())
    .map(([team, row]) => ({
      team,
      locked: row.locked,
      hits: row.hits,
      misses: row.misses,
      hitRate: row.locked > 0 ? Math.round((row.hits / row.locked) * 100) : 0,
      expectedHits: Number(row.expectedHits.toFixed(2)),
      edge: Number((row.hits - row.expectedHits).toFixed(2)),
      victims: Array.from(row.victims),
    }))
    .sort((a, b) => b.edge - a.edge || b.locked - a.locked);

  // Overlap: whose tickets look alike. Identical tickets cannot move the standings.
  const picksByUser = new Map<number, Set<string>>();
  for (const user of allUsers) {
    picksByUser.set(user.id, new Set(seasonPicks.filter(p => p.userId === user.id).map(pickKey)));
  }

  const overlap: OverlapPair[] = [];
  for (let i = 0; i < allUsers.length; i++) {
    for (let j = i + 1; j < allUsers.length; j++) {
      const a = picksByUser.get(allUsers[i].id)!;
      const b = picksByUser.get(allUsers[j].id)!;
      if (a.size === 0 || b.size === 0) continue;

      overlap.push({
        a: allUsers[i].name,
        b: allUsers[j].name,
        shared: sharedCount(a, b),
        similarity: Math.round(similarity(a, b) * 100),
      });
    }
  }
  overlap.sort((x, y) => y.similarity - x.similarity);

  return {
    season,
    currentWeek,
    remainingWeeks,
    players,
    superlatives,
    teamLedger,
    overlap,
  };
}
