import { db } from './db';
import { picks, weeklyScores, games } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { isSameTeam } from './teams';

/**
 * Outcome of a single lock: true = hit, false = miss, null = game not final yet.
 */
export type LockOutcome = true | false | null;

/**
 * All-or-nothing scoring over the subset of games a player locked.
 *
 * A player picks however many games they want; they score one point per lock
 * only if every one of those locks hits. A single miss zeroes the week, and a
 * week that still has a lock in progress is not scoreable yet (it recomputes
 * on the next cron pass).
 *
 * Note this scores the player's own locks, NOT the full slate — players are
 * never required to pick every game in the week.
 */
export function scoreLocks(outcomes: LockOutcome[]): number {
  if (outcomes.length === 0) return 0;
  if (outcomes.some(o => o === false)) return 0;
  if (outcomes.some(o => o === null)) return 0;
  return outcomes.length;
}

/**
 * Resolve one pick against the game it was made on.
 * Returns null when the game is missing or has not finished.
 */
export function resolveLock(
  pick: { gameId: number | null; pickedTeam: string },
  gamesById: Map<number, { status: string; winnerTeam: string | null }>
): LockOutcome {
  const game = gamesById.get(Number(pick.gameId));
  if (!game || game.status !== 'final' || !game.winnerTeam) return null;
  return isSameTeam(game.winnerTeam, pick.pickedTeam);
}

// Calculate weekly score for a user
export async function calculateWeeklyScore(userId: number, season: number, week: number): Promise<number> {
  // Get all picks for the user in this week
  const userPicks = await db.query.picks.findMany({
    where: and(
      eq(picks.userId, userId),
      eq(picks.season, season),
      eq(picks.week, week)
    ),
  });

  if (userPicks.length === 0) {
    return 0; // No picks = 0 points
  }

  // Get all games for this week
  const weekGames = await db.query.games.findMany({
    where: and(
      eq(games.season, season),
      eq(games.week, week)
    ),
  });

  const gamesById = new Map(weekGames.map(g => [Number(g.id), g]));

  return scoreLocks(userPicks.map(pick => resolveLock(pick, gamesById)));
}

// Calculate and store weekly scores for all users
export async function calculateAllWeeklyScores(season: number, week: number) {
  const users = await db.query.users.findMany();
  
  for (const user of users) {
    const points = await calculateWeeklyScore(user.id, season, week);
    
    // Upsert the weekly score
    await db.insert(weeklyScores).values({
      userId: user.id,
      season,
      week,
      points,
    }).onConflictDoUpdate({
      target: [weeklyScores.userId, weeklyScores.season, weeklyScores.week],
      set: { points, computedAt: new Date() },
    });
  }
}

// Get user's total score for the season
export async function getUserSeasonScore(userId: number, season: number): Promise<number> {
  const scores = await db.query.weeklyScores.findMany({
    where: and(
      eq(weeklyScores.userId, userId),
      eq(weeklyScores.season, season)
    ),
  });

  return scores.reduce((total, score) => total + score.points, 0);
}

// Get all users' season scores
export async function getAllSeasonScores(season: number) {
  const users = await db.query.users.findMany();
  const scores = await db.query.weeklyScores.findMany({
    where: eq(weeklyScores.season, season),
  });

  return users.map(user => {
    const userScores = scores.filter(s => s.userId === user.id);
    const totalScore = userScores.reduce((total, score) => total + score.points, 0);
    
    return {
      userId: user.id,
      name: user.name,
      totalScore,
      weeklyScores: userScores,
    };
  }).sort((a, b) => b.totalScore - a.totalScore); // Sort by total score descending
}

// Check if user has submitted picks for a week
export async function hasUserSubmittedPicks(userId: number, season: number, week: number): Promise<boolean> {
  const userPicks = await db.query.picks.findMany({
    where: and(
      eq(picks.userId, userId),
      eq(picks.season, season),
      eq(picks.week, week)
    ),
  });

  return userPicks.length > 0;
}
