import { NextRequest, NextResponse } from 'next/server';
import { getGamesForWeek } from '@/lib/nfl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isMissingGamesTable(error: unknown) {
  return error instanceof Error && error.message.includes('relation "games" does not exist');
}

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

    const games = await getGamesForWeek(season, week).catch((error) => {
      if (isMissingGamesTable(error)) return [];
      throw error;
    });
    
    return NextResponse.json({ games });
  } catch (error) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
