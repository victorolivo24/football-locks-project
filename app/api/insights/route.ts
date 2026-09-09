import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSeasonInsights } from '@/lib/insights';
import { getCurrentNFLWeek } from '@/lib/nfl';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekFallback = getCurrentNFLWeek();
    const season = parseInt(searchParams.get('season') || '') || weekFallback.season;
    const week = parseInt(searchParams.get('week') || '') || weekFallback.week;

    const insights = await getSeasonInsights(season, week);
    return NextResponse.json(insights);
  } catch (error) {
    console.error('Get insights error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
