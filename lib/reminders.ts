import { db } from './db';
import { picks } from './db/schema';
import { and, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { getGamesForWeek } from './nfl';
import { sendAlerts } from './push';

/** How close to the first kickoff a reminder is still worth sending. */
export const REMINDER_WINDOW_HOURS = 30;

/**
 * Whether a reminder is due, given how long until the week's first kickoff.
 *
 * Anchored on the real first kickoff rather than a fixed weekday: week 1 of
 * 2026 opens on a Wednesday, and a Thursday-shaped rule would have missed it
 * entirely. Nothing is sent once the slate has started — by then it is not a
 * reminder, it is a postmortem.
 */
export function reminderDue(hoursUntilKickoff: number): boolean {
  return hoursUntilKickoff > 0 && hoursUntilKickoff <= REMINDER_WINDOW_HOURS;
}

/** Nudge anyone who has not submitted before this week's slate begins. */
export async function sendLockReminders(season: number, week: number): Promise<number> {
  const weekGames = await getGamesForWeek(season, week);
  if (weekGames.length === 0) return 0;

  const firstKickoff = weekGames
    .map(g => new Date(g.startTime as any).getTime())
    .sort((a, b) => a - b)[0];

  const hoursUntil = (firstKickoff - Date.now()) / (1000 * 60 * 60);
  if (!reminderDue(hoursUntil)) return 0;

  const [weekPicks, allUsers] = await Promise.all([
    db.query.picks.findMany({ where: and(eq(picks.season, season), eq(picks.week, week)) }),
    db.query.users.findMany(),
  ]);

  const submitted = new Set(weekPicks.map(p => p.userId));
  const missing = allUsers.filter(u => !submitted.has(u.id));
  if (missing.length === 0) return 0;

  const closes = DateTime.fromMillis(firstKickoff)
    .setZone('America/New_York')
    .toFormat("EEEE 'at' h:mm a");

  const result = await sendAlerts(missing.map(user => ({
    userId: user.id,
    kind: 'lockReminder' as const,
    title: 'You have no locks in',
    body: `Week ${week} starts ${closes}. Get your picks in before kickoff.`,
    url: `/week/${season}/${week}`,
    // One per user per week, so repeated runs replace rather than stack.
    tag: `reminder:${season}:${week}:${user.id}`,
  })));

  return result.sent;
}
