export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { getCurrentNFLWeek, getCurrentWeekFromSchedule } from '@/lib/nfl';

function isMissingGamesTable(error: unknown) {
  return error instanceof Error && error.message.includes('relation "games" does not exist');
}

function thursday8pmOfWeek(et: DateTime) {
  const thu = et
    .startOf('week')
    .plus({ days: 3 })
    .set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
  return thu.toISO();
}

export async function GET() {
  try {
    // The seeded schedule is authoritative for which week is live.
    try {
      const current = await getCurrentWeekFromSchedule();
      if (current) {
        return NextResponse.json({
          season: current.season,
          week: current.week,
          lockTime: thursday8pmOfWeek(current.firstKickoffET),
        });
      }
    } catch (error) {
      if (!isMissingGamesTable(error)) throw error;
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
