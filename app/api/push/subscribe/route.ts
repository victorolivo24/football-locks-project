import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Register this browser for alerts, or update the preferences it already has. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const subscription = body?.subscription;
    const prefs = body?.preferences ?? {};

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const values = {
      userId: user.userId,
      endpoint,
      p256dh,
      auth,
      gameStart: prefs.gameStart ?? true,
      gameFinal: prefs.gameFinal ?? true,
      rivalBust: prefs.rivalBust ?? true,
      rivalHit: prefs.rivalHit ?? false,
      lockReminder: prefs.lockReminder ?? true,
    };

    // The endpoint is the device's identity, so re-subscribing updates in
    // place rather than piling up rows for the same browser.
    await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: values,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Turn alerts off for this browser. */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body?.endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });

    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
