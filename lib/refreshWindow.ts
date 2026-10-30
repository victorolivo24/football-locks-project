/**
 * Decides whether a results poll needs to touch the database at all.
 *
 * The pollers hit resolve-results every minute for ~17 hours on game days,
 * and every hit used to run several queries and writes whether or not a game
 * was on. That kept the Neon compute awake all day and burned the whole free
 * 100 CU-hour allowance in October 2026. The ESPN scoreboard is free to read,
 * so check it first and only wake the database when there is something to record.
 */

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/** How long after kickoff a game is still worth refreshing: covers the final whistle plus overtime. */
export const KICKOFF_WINDOW_MS = 4 * 60 * 60 * 1000;

export interface ScoreboardGame {
  startTime: Date;
  /** ESPN state: 'pre' | 'in' | 'post' */
  state: string;
}

/** True when any game is live, or kicked off recently enough that its final may not be stored yet. */
export function needsRefresh(games: ScoreboardGame[], now = Date.now()): boolean {
  return games.some(g => {
    if (g.state === 'in') return true;
    const sinceKickoff = now - g.startTime.getTime();
    return sinceKickoff >= 0 && sinceKickoff < KICKOFF_WINDOW_MS;
  });
}

/**
 * Reads ESPN's current-week scoreboard, no database involved.
 * Fails open: if ESPN is unreachable, say yes so a refresh is never blocked by it.
 */
export async function anyGameInWindow(): Promise<boolean> {
  try {
    const response = await fetch(ESPN_SCOREBOARD, { cache: 'no-store' });
    if (!response.ok) return true;
    const data = await response.json();
    const games: ScoreboardGame[] = (data.events ?? []).map((e: any) => ({
      startTime: new Date(e.date),
      state: e.status?.type?.state ?? 'pre',
    }));
    return needsRefresh(games);
  } catch (error) {
    console.error('Scoreboard check failed, refreshing anyway:', error);
    return true;
  }
}
