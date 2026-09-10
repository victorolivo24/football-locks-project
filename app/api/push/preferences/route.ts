import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { sendAlerts } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** What this browser is currently signed up for. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const endpoint = new URL(request.url).searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ subscribed: false });

  const row = await db.query.pushSubscriptions.findFirst({
    where: and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.userId)),
  });

  if (!row) return NextResponse.json({ subscribed: false });

  return NextResponse.json({
    subscribed: true,
    preferences: {
      gameStart: row.gameStart,
      gameFinal: row.gameFinal,
      rivalBust: row.rivalBust,
      rivalHit: row.rivalHit,
      lockReminder: row.lockReminder,
    },
  });
}

/** Fire a single test alert so someone can confirm it reaches their phone. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const result = await sendAlerts([{
    userId: user.userId,
    kind: 'gameFinal',
    title: 'Notifications are on',
    body: "This is what an alert looks like. You're all set.",
    url: '/',
    // Unique per send: a fixed tag makes a repeat test silently replace the
    // first notification instead of alerting again, which reads as nothing
    // happening when someone presses the button twice.
    tag: `test:${Date.now()}`,
  }]);

  // Report the failure rather than just a zero, so a broken setup is
  // diagnosable from the page instead of from the server logs.
  return NextResponse.json({
    sent: result.sent,
    error: result.errors[0]
      ? `${result.errors[0].status ?? 'error'}: ${result.errors[0].detail}`
      : undefined,
  });
}
