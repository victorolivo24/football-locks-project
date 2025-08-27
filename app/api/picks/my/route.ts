import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { picks } from '@/lib/db/schema';
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

    const userPicks = await db.query.picks.findMany({
      where: and(
        eq(picks.userId, user.userId),
        eq(picks.season, season),
        eq(picks.week, week)
      ),
    });

    return NextResponse.json({ picks: userPicks });
  } catch (error) {
    console.error('Get my picks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
