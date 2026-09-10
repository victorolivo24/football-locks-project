import { db } from './db';
import { picks } from './db/schema';
import { and, eq } from 'drizzle-orm';
import { fetchNFLSchedule, upsertGames, getGamesForWeek } from './nfl';
import { calculateAllWeeklyScores } from './scoring';
import { buildAlerts, GameState } from './alerts';
import { sendAlerts } from './push';

/**
 * Pull the latest results for a week, rescore it, and alert on what changed.
 *
 * Server only. It reaches web-push, which needs Node built-ins, so it lives
 * apart from lib/nfl.ts — that module is imported by client components and
 * would drag the whole dependency into the browser bundle.
 */
export async function refreshWeekResults(season: number, week: number): Promise<number> {
  const gamesData = await fetchNFLSchedule(season, week);
  if (gamesData.length === 0) return 0;

  // Snapshot before writing, so alerts fire on what actually changed rather
  // than on whatever happens to be true now. Without this every refresh would
  // re-announce every finished game.
  const before = await getGamesForWeek(season, week);

  await upsertGames(gamesData);
  await calculateAllWeeklyScores(season, week);

  const after = await getGamesForWeek(season, week);
  await notifyWeekChanges(season, week, before as any, after as any);

  return gamesData.length;
}

/** Push whatever this refresh changed to the people who asked to hear about it. */
async function notifyWeekChanges(
  season: number,
  week: number,
  before: GameState[],
  after: GameState[]
) {
  try {
    const [weekPicks, allUsers] = await Promise.all([
      db.query.picks.findMany({
        where: and(eq(picks.season, season), eq(picks.week, week)),
      }),
      db.query.users.findMany(),
    ]);

    const messages = buildAlerts(
      before,
      after,
      weekPicks.map(p => ({ userId: p.userId as number, gameId: Number(p.gameId), pickedTeam: p.pickedTeam })),
      allUsers.map(u => ({ id: u.id, name: u.name })),
      `/picks/${season}/${week}`
    );

    await sendAlerts(messages);
  } catch (error) {
    // Never let a notification failure break scoring.
    console.error('Alert dispatch failed:', error);
  }
}
