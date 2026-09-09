import { db } from './db';
import { games, gameOdds } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { isSameTeam } from './teams';

export interface WeekOddsRow {
  gameId: number;
  season: number;
  week: number;
  awayMoneyline: number | null;
  homeMoneyline: number | null;
  spread: string | null;
  total: number | null;
}

/**
 * True once a game has kicked off, meaning its line is final and must not be
 * refreshed again. This is what makes a daily pull safe: the last value
 * written before kickoff is the closing line, and nothing later can overwrite
 * it with in-play numbers.
 */
export function isLineSettled(startTime: Date | string | null | undefined, now: number = Date.now()): boolean {
  if (!startTime) return false;
  const kickoff = new Date(startTime).getTime();
  return Number.isFinite(kickoff) && kickoff <= now;
}

/** ESPN reports American odds as strings like "+142" / "-166" / "EVEN". */
function parseAmerican(odds: unknown): number | null {
  if (typeof odds !== 'string') return null;
  const trimmed = odds.trim();
  if (/^even$/i.test(trimmed)) return 100;
  const value = Number(trimmed.replace('+', ''));
  return Number.isFinite(value) && value !== 0 ? value : null;
}

/**
 * Pull this week's lines from the ESPN scoreboard.
 *
 * The scoreboard already carries a full odds block per game, so the whole
 * slate costs one request and no API key. We take the closing number and
 * fall back to the opening one when a book has not posted a close yet.
 *
 * Games that have already kicked off are skipped, which is what lets this run
 * daily. A line keeps moving until its game starts and is then frozen at that
 * last pre-kickoff value — the closing line, and the sharpest read on true win
 * probability we can get. Without the skip, a later run could overwrite a
 * settled line with in-play numbers and quietly corrupt the luck ledger.
 */
export async function fetchWeekOddsFromEspn(season: number, week: number): Promise<WeekOddsRow[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`ESPN odds error: ${response.status}`);

  const data = await response.json();
  const weekGames = await db.query.games.findMany({
    where: and(eq(games.season, season), eq(games.week, week)),
  });

  const rows: WeekOddsRow[] = [];
  const now = Date.now();

  for (const event of data.events || []) {
    const competition = event.competitions?.[0];
    const odds = competition?.odds?.[0];
    if (!odds) continue;

    const competitors = competition.competitors || [];
    const homeTeam = competitors.find((c: any) => c.homeAway === 'home')?.team?.name;
    const awayTeam = competitors.find((c: any) => c.homeAway === 'away')?.team?.name;

    // ESPN event ids differ from our seeded game ids, so match on the matchup.
    const game = weekGames.find(g => isSameTeam(g.homeTeam, homeTeam) && isSameTeam(g.awayTeam, awayTeam));
    if (!game) continue;

    // Already under way: its line is settled, leave it alone.
    if (isLineSettled(game.startTime as any, now)) continue;

    const line = (side: 'home' | 'away') =>
      parseAmerican(odds.moneyline?.[side]?.close?.odds) ?? parseAmerican(odds.moneyline?.[side]?.open?.odds);

    rows.push({
      gameId: Number(game.id),
      season,
      week,
      awayMoneyline: line('away'),
      homeMoneyline: line('home'),
      spread: typeof odds.details === 'string' ? odds.details : null,
      total: typeof odds.overUnder === 'number' ? odds.overUnder : null,
    });
  }

  return rows;
}

/** Overwrite the stored line for each game. One row per game, no history. */
export async function saveWeekOdds(rows: WeekOddsRow[]) {
  for (const row of rows) {
    await db.insert(gameOdds).values(row).onConflictDoUpdate({
      target: gameOdds.gameId,
      set: {
        awayMoneyline: row.awayMoneyline,
        homeMoneyline: row.homeMoneyline,
        spread: row.spread,
        total: row.total,
      },
    });
  }
}

export async function getWeekOdds(season: number, week: number) {
  return db.query.gameOdds.findMany({
    where: and(eq(gameOdds.season, season), eq(gameOdds.week, week)),
  });
}

/** Fetch and store this week's lines. Returns how many games were priced. */
export async function refreshWeekOdds(season: number, week: number): Promise<number> {
  const rows = await fetchWeekOddsFromEspn(season, week);
  await saveWeekOdds(rows);
  return rows.length;
}
