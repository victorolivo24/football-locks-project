import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getCurrentNFLWeek,
  getCurrentWeekFromSchedule,
  hasUnresolvedGames,
  refreshWeekResults,
} from '@/lib/nfl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Vercel's Hobby plan caps cron jobs at one run per day, so the nightly sweep
// cannot deliver scores mid-slate. The scoreboard calls this instead, which
// keeps results current on Sunday afternoon without anyone touching admin.
const COOLDOWN_MS = 2 * 60 * 1000;
let lastRefreshAt = 0;

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (Date.now() - lastRefreshAt < COOLDOWN_MS) {
      return NextResponse.json({ refreshed: false, reason: 'cooldown' });
    }

    const { season, week } = (await getCurrentWeekFromSchedule()) ?? getCurrentNFLWeek();

    // Don't spend a request on ESPN when nothing has kicked off yet.
    if (!(await hasUnresolvedGames(season, week))) {
      return NextResponse.json({ refreshed: false, reason: 'nothing in play', season, week });
    }

    lastRefreshAt = Date.now();
    const updated = await refreshWeekResults(season, week);

    return NextResponse.json({ refreshed: true, season, week, games: updated });
  } catch (error) {
    console.error('Refresh results error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
