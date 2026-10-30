import { NextRequest, NextResponse } from 'next/server';
import { getCurrentNFLWeek, getCurrentWeekFromSchedule } from '@/lib/nfl';
import { refreshWeekResults } from '@/lib/results';
import { anyGameInWindow } from '@/lib/refreshWindow';

async function handler(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;
    
    if (authHeader !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Vercel's once-a-day sweep always runs in full (it sends this header);
    // the minute-by-minute pollers only wake the database when a game is on.
    const isNightlySweep = request.headers.has('x-vercel-cron-schedule');
    if (!isNightlySweep && !(await anyGameInWindow())) {
      return NextResponse.json({ success: true, message: 'No games in progress; skipped' });
    }

    const { season, week } = (await getCurrentWeekFromSchedule()) ?? getCurrentNFLWeek();

    const updated = await refreshWeekResults(season, week);
    console.log(`Updated results and recalculated scores for Week ${week} (${updated} games)`);

    return NextResponse.json({ 
      success: true, 
      message: `Processed results for Week ${week}` 
    });
  } catch (error) {
    console.error('Resolve results cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Vercel Cron invokes the endpoint with GET, so that is the verb that matters
// in production; POST is kept for triggering a run by hand.
export const GET = handler;
export const POST = handler;
