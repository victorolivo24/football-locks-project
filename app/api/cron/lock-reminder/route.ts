import { NextRequest, NextResponse } from 'next/server';
import { getCurrentNFLWeek, getCurrentWeekFromSchedule } from '@/lib/nfl';
import { sendLockReminders } from '@/lib/reminders';

async function handler(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { season, week } = (await getCurrentWeekFromSchedule()) ?? getCurrentNFLWeek();
    const sent = await sendLockReminders(season, week);

    console.log(`Lock reminders sent for Week ${week}: ${sent}`);
    return NextResponse.json({ success: true, week, sent });
  } catch (error) {
    console.error('Lock reminder cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Vercel Cron invokes the endpoint with GET.
export const GET = handler;
export const POST = handler;
