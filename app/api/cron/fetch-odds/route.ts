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
    const priced = await refreshWeekOdds(season, week);

    console.log(`Stored odds for ${priced} games in Week ${week}`);

    return NextResponse.json({
      success: true,
      message: `Stored odds for ${priced} games in Week ${week}`,
    });
  } catch (error) {
    console.error('Fetch odds cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
