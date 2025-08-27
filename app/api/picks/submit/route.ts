import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isPicksLocked } from '@/lib/nfl';
import { db } from '@/lib/db';
import { picks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { season, week, picks: userPicks } = await request.json();

    if (!season || !week || !userPicks || !Array.isArray(userPicks)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Check if picks are locked
    if (isPicksLocked(season, week)) {
      return NextResponse.json(
        { error: 'Picks are locked for this week' },
        { status: 403 }
      );
    }

    // Check if user already submitted picks for this week
    const existingPicks = await db.query.picks.findMany({
      where: and(
        eq(picks.userId, user.userId),
        eq(picks.season, season),
        eq(picks.week, week)
      ),
    });

    if (existingPicks.length > 0) {
      return NextResponse.json(
        { error: 'Picks already submitted for this week' },
        { status: 409 }
      );
    }

    // Insert picks
    const picksToInsert = userPicks.map((pick: any) => ({
      userId: user.userId,
      gameId: pick.gameId,
      pickedTeam: pick.pickedTeam,
      week,
      season,
    }));

    await db.insert(picks).values(picksToInsert);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Submit picks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
