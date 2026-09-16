import { db } from './db';
import { games, picks } from './db/schema';
import { and, eq } from 'drizzle-orm';
import { fetchNFLSchedule, upsertGames, getGamesForWeek } from './nfl';
import { isSameTeam } from './teams';
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
  await recordWinProbability(gamesData, before);
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

/**
 * Store live win probability for games in play, and for games that finished
 * since the last refresh so a comeback is still caught at the final whistle.
 *
 * ESPN's summary carries the whole in-game probability curve, so the low and
 * high are taken over all of it — a dip is caught even if no refresh happened
 * to run at that moment.
 */
async function recordWinProbability(gamesData: any[], before: any[]) {
  await Promise.all(gamesData.map(async (espn) => {
    const stored = before.find(g => isSameTeam(g.homeTeam, espn.homeTeam) && isSameTeam(g.awayTeam, espn.awayTeam));
    if (!stored) return;

    const inPlay = espn.status === 'in_progress' || (espn.status === 'final' && stored.status !== 'final');
    if (!inPlay) return;

    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espn.id}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const curve = ((await res.json()).winprobability ?? [])
        .map((p: any) => Number(p.homeWinPercentage))
        .filter((v: number) => Number.isFinite(v));
      if (curve.length === 0) return;

      await db.update(games).set({
        homeWinLow: Math.min(...curve),
        homeWinHigh: Math.max(...curve),
        homeWinProb: curve[curve.length - 1],
      }).where(eq(games.id, stored.id));
    } catch (error) {
      // Win probability is decoration; never let it break scoring.
      console.error('Win probability fetch failed:', error);
    }
  }));
}
