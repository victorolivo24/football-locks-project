import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasUserSubmittedPicks } from '@/lib/scoring';
import { db } from '@/lib/db';
import { picks, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || '');
    const week = parseInt(searchParams.get('week') || '');

    if (!season || !week) {
      return NextResponse.json(
        { error: 'Season and week parameters are required' },
        { status: 400 }
      );
    }

    // Check if user has submitted picks for this week
    const hasSubmitted = await hasUserSubmittedPicks(user.userId, season, week);
    if (!hasSubmitted) {
      return NextResponse.json(
        { error: 'You must submit your picks first to view others' },
        { status: 403 }
      );
    }

    // Get all picks for this week with user names
    const allPicks = await db
      .select({
        userId: picks.userId,
        gameId: picks.gameId,
        pickedTeam: picks.pickedTeam,
        userName: users.name,
      })
      .from(picks)
      .innerJoin(users, eq(picks.userId, users.id))
      .where(and(eq(picks.season, season), eq(picks.week, week)));

    // Group picks by user
    const picksByUser = allPicks.reduce((acc, pick) => {
      if (!acc[pick.userName]) {
        acc[pick.userName] = [];
      }
      acc[pick.userName].push({
        gameId: pick.gameId,
        pickedTeam: pick.pickedTeam,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({ picksByUser });
  } catch (error) {
    console.error('Get all picks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
