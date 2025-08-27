import { NextRequest, NextResponse } from 'next/server';
import { fetchNFLSchedule, upsertGames, getCurrentNFLWeek } from '@/lib/nfl';

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

    // Get next week's schedule
    const { season, week } = getCurrentNFLWeek();
    const nextWeek = week + 1;
    
    // Fetch schedule from ESPN
    const gamesData = await fetchNFLSchedule(season, nextWeek);
    
    if (gamesData.length > 0) {
      // Upsert games into database
      await upsertGames(gamesData);
      
      console.log(`Fetched and updated ${gamesData.length} games for Week ${nextWeek}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Processed ${gamesData.length} games for Week ${nextWeek}` 
    });
  } catch (error) {
    console.error('Fetch schedule cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
