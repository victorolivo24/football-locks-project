export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { getCurrentNFLWeek } from '@/lib/nfl';
import { db } from '@/lib/db';
import { games } from '@/lib/db/schema';
import { desc, asc, eq } from 'drizzle-orm';

function thursday8pmOfWeek(et: DateTime) {
  const thu = et
    .startOf('week')
    .plus({ days: 3 })
    .set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
  return thu.toISO();
}

export async function GET() {
  try {
    // First try to get the latest week that has games in the database
    // Determine the latest season that has any games
    const seasonAnchor = await db.query.games.findFirst({
      orderBy: [desc(games.season), asc(games.week)],
    });

    if (seasonAnchor) {
      const season = seasonAnchor.season;
      // Pull all games for that season and compute earliest kickoff per week
      const seasonGames = await db.query.games.findMany({ where: eq(games.season, season) });
      const byWeek = new Map<number, Date>();
      for (const g of seasonGames) {
        const w = g.week;
        const t = new Date(g.startTime as any);
        const prev = byWeek.get(w);
        if (!prev || t < prev) byWeek.set(w, t);
      }

      // Build week open times: Tuesday 7:00 AM ET of the game week (based on earliest kickoff)
      const weekWindows = Array.from(byWeek.entries())
        .map(([week, firstKick]) => {
          const firstET = DateTime.fromJSDate(firstKick).setZone('America/New_York');
          const tuesday7 = firstET
            .startOf('week')
            .plus({ days: 1 })
            .set({ hour: 7, minute: 0, second: 0, millisecond: 0 });
          return { week, firstET, openAt: tuesday7 };
        })
        .sort((a, b) => a.week - b.week);

      if (weekWindows.length > 0) {
        const now = DateTime.now().setZone('America/New_York');
        // Find the last week whose openAt is <= now; if none, use the first
        let currentWeek = weekWindows[0].week;
        let currentFirstET = weekWindows[0].firstET;
        for (const w of weekWindows) {
          if (now >= w.openAt) {
            currentWeek = w.week;
            currentFirstET = w.firstET;
          } else break;
        }
        const lockTime = thursday8pmOfWeek(currentFirstET);
        return NextResponse.json({ season, week: currentWeek, lockTime });
      }
    }

    // Fallback to calculated week if no games in database
    const { season, week } = getCurrentNFLWeek();
    const firstET = DateTime.now().setZone('America/New_York');
    const lockTime = thursday8pmOfWeek(firstET);
    return NextResponse.json({ season, week, lockTime });
  } catch (error) {
    console.error('Get current week error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
