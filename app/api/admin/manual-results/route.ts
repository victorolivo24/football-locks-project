import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateGameResult, calculateAllWeeklyScores } from '@/lib/nfl';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { passcode, gameId, winnerTeam, status, season, week } = await request.json();

    // Verify admin passcode
    if (passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json(
        { error: 'Invalid admin passcode' },
        { status: 401 }
      );
    }

    if (!gameId || !winnerTeam || !status) {
      return NextResponse.json(
        { error: 'Game ID, winner team, and status are required' },
        { status: 400 }
      );
    }

    // Update game result
    await updateGameResult(gameId, winnerTeam, status);

    // If season and week provided, recalculate scores
    if (season && week) {
      await calculateAllWeeklyScores(season, week);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual results update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
