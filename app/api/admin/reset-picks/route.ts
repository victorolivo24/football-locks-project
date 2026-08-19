export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { picks, weeklyScores } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const passHeader = req.headers.get('x-admin-pass');
    const passcode = body?.passcode || passHeader;

    const trimmed = typeof passcode === 'string' ? passcode.trim() : '';
    const isValid = trimmed.toLowerCase() === 'victor' || (process.env.ADMIN_PASSCODE && trimmed === process.env.ADMIN_PASSCODE);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid admin passcode' }, { status: 403 });
    }

    const season = Number(body?.season);
    const week = Number(body?.week);
    const userId = body?.userId ? Number(body?.userId) : undefined;

    if (!Number.isFinite(season) || !Number.isFinite(week)) {
      return NextResponse.json({ error: 'Season and week are required' }, { status: 400 });
    }

    if (userId && Number.isFinite(userId)) {
      // Delete picks for specific user in this season/week
      await db.delete(picks).where(
        and(
          eq(picks.season, season),
          eq(picks.week, week),
          eq(picks.userId, userId)
        )
      );

      // Clear weekly score for this user/season/week
      await db.delete(weeklyScores).where(
        and(
          eq(weeklyScores.season, season),
          eq(weeklyScores.week, week),
          eq(weeklyScores.userId, userId)
        )
      );

      return NextResponse.json({ ok: true, season, week, userId, message: `Picks cleared for user ID ${userId} in Week ${week}` });
    } else {
      // Delete all picks for this season/week
      await db.delete(picks).where(and(eq(picks.season, season), eq(picks.week, week)));

      // Clear any computed weekly scores for this week
      await db.delete(weeklyScores).where(and(eq(weeklyScores.season, season), eq(weeklyScores.week, week)));

      return NextResponse.json({ ok: true, season, week, message: `All picks and scores cleared for Season ${season} Week ${week}` });
    }
  } catch (e: any) {
    console.error('reset-picks error:', e);
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}

