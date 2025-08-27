import { db } from './db';
import { picks, weeklyScores, games } from './db/schema';
import { eq, and } from 'drizzle-orm';

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

  // Check if all games are final
  const allGamesFinal = weekGames.every(game => game.status === 'final');
  if (!allGamesFinal) {
    return 0; // Games not finished yet
  }

  // Check if user picked all games
  const gamesWithPicks = weekGames.filter(game => 
    userPicks.some(pick => pick.gameId === game.id)
  );

  if (gamesWithPicks.length !== weekGames.length) {
    return 0; // Didn't pick all games
  }

  // Check if all picks are correct
  const allPicksCorrect = userPicks.every(pick => {
    const game = weekGames.find(g => g.id === pick.gameId);
    return game && game.winnerTeam === pick.pickedTeam;
  });

  // All-or-nothing scoring: if all picks correct, get points equal to number of picks
  return allPicksCorrect ? userPicks.length : 0;
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
      set: { points },
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
