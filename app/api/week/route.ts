import { NextResponse } from 'next/server';
import { getCurrentNFLWeek } from '@/lib/nfl';

export async function GET() {
  try {
    const { season, week } = getCurrentNFLWeek();
    
    return NextResponse.json({ season, week });
  } catch (error) {
    console.error('Get current week error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
