import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllSeasonScores } from '@/lib/scoring';

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

    if (!season) {
      return NextResponse.json(
        { error: 'Season parameter is required' },
        { status: 400 }
      );
    }

    const scores = await getAllSeasonScores(season);

    return NextResponse.json({ scores });
  } catch (error) {
    console.error('Get scoreboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
