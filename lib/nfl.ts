import { DateTime } from 'luxon';
import { db } from './db';
import { games } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { users, picks, weeklyScores } from './db/schema';

import { sql } from 'drizzle-orm';

// ESPN API types
interface ESPNGame {
  id: string;
  name: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
    };
  };
  competitions: Array<{
    competitors: Array<{
      team: {
        name: string;
        abbreviation: string;
      };
      homeAway: 'home' | 'away';
    }>;
    winner?: string;
  }>;
}

interface ESPNResponse {
  events: ESPNGame[];
}

// Get current NFL season and week
export function getCurrentNFLWeek(): { season: number; week: number } {
  const now = DateTime.now().setZone('America/New_York');
  const currentYear = now.year;

  // NFL season typically starts in September
  // For simplicity, we'll use the current year as the season
  // In a real implementation, you'd want to handle the season transition properly
  const season = currentYear;

  // Calculate week based on NFL calendar
  // This is a simplified calculation - in production you'd want a more accurate NFL calendar
  const nflStartDate = DateTime.fromObject({ year: season, month: 9, day: 1 }, { zone: 'America/New_York' });
  const weekDiff = Math.floor(now.diff(nflStartDate, 'weeks').weeks);
  const week = Math.max(1, Math.min(18, weekDiff + 1)); // NFL has 18 weeks

  return { season, week };
}

// Get lock time for a given week (Wednesday for Week 1, Thursday for others)
export function getLockTime(season: number, week: number): DateTime {
  const baseDate = DateTime.fromObject({ year: season, month: 9, day: 1 }, { zone: 'America/New_York' });
  
  // Find the first Monday of September to establish a reliable week start
  let firstMonday = baseDate;
  while (firstMonday.weekday !== 1) { // 1 is Monday in Luxon
    firstMonday = firstMonday.plus({ days: 1 });
  }
  
  const weekStart = firstMonday.plus({ weeks: week - 1 });
  
  // If it's week 1, lock on Wednesday
  if (week === 1) {
    const wednesday = weekStart.plus({ days: 2 }); // Wednesday is 2 days after Monday
    return wednesday.set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
  }

  const thursday = weekStart.plus({ days: 3 }); // Thursday is 3 days after Monday
  return thursday.set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
}

// Check if picks are locked for a given week
export function isPicksLocked(season: number, week: number): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_LOCKS === '1') return false; // dev override
  const lockTime = getLockTime(season, week);
  const now = DateTime.now().setZone('America/New_York');
  return now >= lockTime;
}
export { calculateAllWeeklyScores } from './scoring';

// Fetch NFL schedule from ESPN API
export async function fetchNFLSchedule(season: number, week: number): Promise<any[]> {
  try {
    // ESPN API endpoint for NFL scoreboard
    const startDate = DateTime.fromObject({ year: season, month: 9, day: 1 }, { zone: 'America/New_York' })
      .plus({ weeks: week - 1 });
    const endDate = startDate.plus({ days: 6 });

    const startDateStr = startDate.toFormat('yyyyMMdd');
    const endDateStr = endDate.toFormat('yyyyMMdd');

    const url = `https://site.api.espn.com/apis/v2/sports/football/nfl/scoreboard?dates=${startDateStr}-${endDateStr}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data: ESPNResponse = await response.json();

    return data.events.map(event => ({
      id: parseInt(event.id),
      season,
      week,
      startTime: DateTime.fromISO(event.date).setZone('America/New_York').toISO(),
      homeTeam: event.competitions[0]?.competitors.find(c => c.homeAway === 'home')?.team.name || '',
      awayTeam: event.competitions[0]?.competitors.find(c => c.homeAway === 'away')?.team.name || '',
      winnerTeam: null,
      status: event.status.type.state === 'post' ? 'final' :
        event.status.type.state === 'in' ? 'in_progress' : 'scheduled'
    }));
  } catch (error) {
    console.error('Error fetching NFL schedule:', error);
    return [];
  }
}

// Upsert games into database
export async function upsertGames(gamesData: any[]) {
  for (const gameData of gamesData) {
    await db.insert(games).values(gameData)
      .onConflictDoUpdate({
        target: games.id,
        set: {
          startTime: gameData.startTime,
          homeTeam: gameData.homeTeam,
          awayTeam: gameData.awayTeam,
          status: gameData.status,
          winnerTeam: gameData.winnerTeam,
        }
      });
  }
}

// Get games for a specific week
export async function getGamesForWeek(season: number, week: number) {
  return await db.query.games.findMany({
    where: and(eq(games.season, season), eq(games.week, week)),
    orderBy: games.startTime,
  });
}

// Update game results
export async function updateGameResult(gameId: number, winnerTeam: string | null, status: string) {
  await db.update(games)
    .set({ winnerTeam, status })
    .where(eq(games.id, gameId));
}
