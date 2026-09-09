import { NextRequest, NextResponse } from 'next/server';
import { getCurrentNFLWeek, getCurrentWeekFromSchedule } from '@/lib/nfl';
import { refreshWeekOdds } from '@/lib/espnOdds';

export async function POST(request: NextRequest) {
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

    const { season, week } = (await getCurrentWeekFromSchedule()) ?? getCurrentNFLWeek();

    // Refresh next week too, so lines are already there for anyone picking
    // early — the live week only rolls over on Tuesday morning.
    const priced = await refreshWeekOdds(season, week);
    const nextPriced = week < 18 ? await refreshWeekOdds(season, week + 1).catch(() => 0) : 0;

    console.log(`Refreshed odds: ${priced} games in Week ${week}, ${nextPriced} in Week ${week + 1}`);

    return NextResponse.json({
      success: true,
      message: `Refreshed odds for ${priced} games in Week ${week}, ${nextPriced} in Week ${week + 1}`,
    });
  } catch (error) {
    console.error('Fetch odds cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
