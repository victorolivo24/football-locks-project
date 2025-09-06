// remove getCurrentUser requirement to simplify MVP:
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { updateGameResult, calculateAllWeeklyScores } from '@/lib/nfl';

export async function POST(request: NextRequest) {
  try {
    const { passcode, gameId, winnerTeam, status, season, week } = await request.json();

    if (passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'Invalid admin passcode' }, { status: 401 });
    }
    if (!gameId || !winnerTeam || !status) {
      return NextResponse.json({ error: 'Game ID, winner team, and status are required' }, { status: 400 });
    }

    await updateGameResult(Number(gameId), String(winnerTeam), String(status));

    if (season && week) {
      await calculateAllWeeklyScores(Number(season), Number(week));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual results update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
