import { DateTime } from 'luxon';
import { db } from './db';
import { games } from './db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { users, picks, weeklyScores } from './db/schema';
import { isSameTeam } from './teams';
import { calculateAllWeeklyScores } from './scoring';

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
      winner?: boolean;
    }>;
  }>;
}

interface ESPNResponse {
  events: ESPNGame[];
}

// Get current NFL season and week.
// Drifts against the real NFL calendar and flips season on Jan 1 — kept only as
// a fallback for when no schedule is seeded. Prefer getCurrentWeekFromSchedule().
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

/**
 * Pick the active week out of each week's earliest kickoff.
 *
 * A week opens the Tuesday 7:00 AM ET before its first game and stays current
 * until the next week opens.
 */
export function resolveWeekFromKickoffs(
  kickoffsByWeek: Map<number, Date>,
  now: DateTime
): { week: number; firstKickoffET: DateTime } | null {
  const windows = Array.from(kickoffsByWeek.entries())
    .map(([week, firstKick]) => {
      const firstET = DateTime.fromJSDate(firstKick).setZone('America/New_York');
      return {
        week,
        firstKickoffET: firstET,
        opensAt: firstET.startOf('week').plus({ days: 1 }).set({ hour: 7, minute: 0, second: 0, millisecond: 0 }),
      };
    })
    .sort((a, b) => a.week - b.week);

  if (windows.length === 0) return null;

  let current = windows[0];
  for (const w of windows) {
    if (now >= w.opensAt) current = w;
    else break;
  }
  return { week: current.week, firstKickoffET: current.firstKickoffET };
}

/**
 * Resolve the active season/week from the seeded schedule.
 *
 * Prefer this over getCurrentNFLWeek(): counting weeks from a fixed September
 * date drifts against the real NFL calendar (it reads week 2 on the opening
 * Wednesday of 2026) and rolls the season over on Jan 1, mid playoff push.
 * Returns null when no schedule is seeded, so callers can fall back.
 */
export async function getCurrentWeekFromSchedule(): Promise<{ season: number; week: number; firstKickoffET: DateTime } | null> {
  const latest = await db.query.games.findFirst({
    orderBy: [desc(games.season), asc(games.week)],
  });
  if (!latest) return null;

  const season = latest.season;
  const seasonGames = await db.query.games.findMany({ where: eq(games.season, season) });

  const kickoffsByWeek = new Map<number, Date>();
  for (const g of seasonGames) {
    const kickoff = new Date(g.startTime as any);
    const earliest = kickoffsByWeek.get(g.week);
    if (!earliest || kickoff < earliest) kickoffsByWeek.set(g.week, kickoff);
  }

  const resolved = resolveWeekFromKickoffs(kickoffsByWeek, DateTime.now().setZone('America/New_York'));
  return resolved ? { season, ...resolved } : null;
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
export { calculateAllWeeklyScores };

// Fetch NFL schedule from ESPN API
export async function fetchNFLSchedule(season: number, week: number): Promise<any[]> {
  try {
    // Query by season/week rather than a date range: date math drifts against
    // the real NFL calendar and silently returns the wrong (or a partial) slate.
    // ESPN spells the season year `dates` here; a `year` param is ignored and
    // quietly falls back to the current season.
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data: ESPNResponse = await response.json();

    return data.events.map(event => {
      const competitors = event.competitions[0]?.competitors || [];
      const home = competitors.find(c => c.homeAway === 'home');
      const away = competitors.find(c => c.homeAway === 'away');
      const winner = competitors.find(c => c.winner === true);

      return {
        id: parseInt(event.id),
        season,
        week,
        startTime: new Date(event.date),
        homeTeam: home?.team.name || '',
        awayTeam: away?.team.name || '',
        winnerTeam: winner?.team.name || null,
        status: event.status.type.state === 'post' ? 'final' :
          event.status.type.state === 'in' ? 'in_progress' : 'scheduled'
      };
    });
  } catch (error) {
    console.error('Error fetching NFL schedule:', error);
    return [];
  }
}

// Upsert games into database.
// The season schedule is seeded with our own game ids, but ESPN returns its
// event ids, so matching on id alone would insert a duplicate game that none
// of the existing picks point at. Match on the matchup instead and fall back
// to inserting only when the game is genuinely new.
export async function upsertGames(gamesData: any[]) {
  const existingByWeek = new Map<string, Awaited<ReturnType<typeof getGamesForWeek>>>();

  for (const gameData of gamesData) {
    const key = `${gameData.season}-${gameData.week}`;
    if (!existingByWeek.has(key)) {
      existingByWeek.set(key, await getGamesForWeek(gameData.season, gameData.week));
    }

    const existing = (existingByWeek.get(key) || []).find(g =>
      isSameTeam(g.homeTeam, gameData.homeTeam) && isSameTeam(g.awayTeam, gameData.awayTeam)
    );

    if (existing) {
      await db.update(games)
        .set({
          startTime: gameData.startTime,
          status: gameData.status,
          // Never clear a winner we already have: ESPN reports none until the
          // game is final, and results may have been entered manually.
          winnerTeam: gameData.winnerTeam ?? existing.winnerTeam,
        })
        .where(eq(games.id, existing.id));
      continue;
    }

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

/**
 * Pull the latest results for a week and rescore it.
 *
 * Used by the nightly cron and by the on-demand refresh the scoreboard fires,
 * so results land without anyone opening the admin page.
 */
export async function refreshWeekResults(season: number, week: number): Promise<number> {
  const gamesData = await fetchNFLSchedule(season, week);
  if (gamesData.length === 0) return 0;

  await upsertGames(gamesData);
  await calculateAllWeeklyScores(season, week);
  return gamesData.length;
}

/**
 * True when a game has kicked off but has no result yet, i.e. there is
 * something for a refresh to actually pick up.
 */
export async function hasUnresolvedGames(season: number, week: number): Promise<boolean> {
  const weekGames = await getGamesForWeek(season, week);
  const now = Date.now();
  return weekGames.some(g => g.status !== 'final' && new Date(g.startTime as any).getTime() <= now);
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
