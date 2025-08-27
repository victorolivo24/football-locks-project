import { NextRequest, NextResponse } from 'next/server';
import { getGamesForWeek } from '@/lib/nfl';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || '');
    const week = parseInt(searchParams.get('week') || '');

    if (!season || !week) {
      return NextResponse.json(
        { error: 'Season and week parameters are required' },
        { status: 400 }
      );
    }

    const games = await getGamesForWeek(season, week);
    
    return NextResponse.json({ games });
  } catch (error) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
