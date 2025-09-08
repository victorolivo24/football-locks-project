export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { computeTitleOdds } from '@/lib/odds';
import { getCurrentNFLWeek } from '@/lib/nfl';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekFallback = getCurrentNFLWeek();
    const season = Number(searchParams.get('season')) || weekFallback.season;
    const week = Number(searchParams.get('week')) || weekFallback.week;

    const data = await computeTitleOdds(season, week);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('odds error:', e);
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 });
  }
}

