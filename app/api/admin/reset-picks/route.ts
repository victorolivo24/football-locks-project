export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { picks, weeklyScores } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const pass = req.headers.get('x-admin-pass');
    if (pass !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'forbidden (bad admin pass)' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const season = Number(body?.season);
    const week = Number(body?.week);
    if (!Number.isFinite(season) || !Number.isFinite(week)) {
      return NextResponse.json({ error: 'season & week required (numbers)' }, { status: 400 });
    }

    // Delete picks for this season/week
    await db.delete(picks).where(and(eq(picks.season, season), eq(picks.week, week)));

    // Also clear any computed weekly scores for this week to avoid stale totals
    await db.delete(weeklyScores).where(and(eq(weeklyScores.season, season), eq(weeklyScores.week, week)));

    return NextResponse.json({ ok: true, season, week, message: 'Picks and weekly scores cleared' });
  } catch (e: any) {
    console.error('reset-picks error:', e);
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 });
  }
}

