import { NextResponse } from 'next/server';
import { getCurrentNFLWeek } from '@/lib/nfl';
import { db } from '@/lib/db';
import { games } from '@/lib/db/schema';
import { desc, and } from 'drizzle-orm';

export async function GET() {
  try {
    // First try to get the latest week that has games in the database
    const latestGame = await db.query.games.findFirst({
      orderBy: [desc(games.season), desc(games.week)],
    });

    if (latestGame) {
      return NextResponse.json({
        season: latestGame.season,
        week: latestGame.week
      });
    }

    // Fallback to calculated week if no games in database
    const { season, week } = getCurrentNFLWeek();
    return NextResponse.json({ season, week });
  } catch (error) {
    console.error('Get current week error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
