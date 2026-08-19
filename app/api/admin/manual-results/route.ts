// remove getCurrentUser requirement to simplify MVP:
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { updateGameResult } from '@/lib/nfl';
import { calculateAllWeeklyScores } from '@/lib/scoring';

export async function POST(request: NextRequest) {
  try {
    const { passcode, gameId, winnerTeam, status, season, week, recomputeOnly } = await request.json();

    if (!process.env.ADMIN_PASSCODE || passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'Invalid admin passcode' }, { status: 401 });
    }

    if (recomputeOnly) {
      if (season && week) {
        await calculateAllWeeklyScores(Number(season), Number(week));
      }
      return NextResponse.json({ success: true, message: 'Scores recalculated successfully' });
    }

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    const newWinner = winnerTeam ? String(winnerTeam) : null;
    const newStatus = status ? String(status) : (newWinner ? 'final' : 'scheduled');

    await updateGameResult(Number(gameId), newWinner, newStatus);

    if (season && week) {
      await calculateAllWeeklyScores(Number(season), Number(week));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual results update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
