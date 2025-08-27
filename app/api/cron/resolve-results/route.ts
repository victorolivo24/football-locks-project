import { NextRequest, NextResponse } from 'next/server';
import { fetchNFLSchedule, upsertGames, getCurrentNFLWeek } from '@/lib/nfl';
import { calculateAllWeeklyScores } from '@/lib/scoring';

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

    const { season, week } = getCurrentNFLWeek();
    
    // Fetch current week's results to update game statuses
    const gamesData = await fetchNFLSchedule(season, week);
    
    if (gamesData.length > 0) {
      // Update games with latest results
      await upsertGames(gamesData);
      
      // Recalculate weekly scores for this week
      await calculateAllWeeklyScores(season, week);
      
      console.log(`Updated results and recalculated scores for Week ${week}`);
    }

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
