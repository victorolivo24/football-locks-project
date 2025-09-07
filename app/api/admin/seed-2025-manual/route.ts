export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { games } from '@/lib/db/schema';
import { SEASON_2025_WEEKS_3_TO_18 } from '@/lib/schedules/season2025';

export async function POST(req: NextRequest) {
  try {
    const pass = req.headers.get('x-admin-pass');
    if (pass !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'forbidden (bad admin pass)' }, { status: 403 });
    }

    const inserted: Array<{ week: number; count: number }> = [];
    for (const [weekStr, list] of Object.entries(SEASON_2025_WEEKS_3_TO_18)) {
      const week = Number(weekStr);
      for (const g of list) {
        await db.insert(games).values({
          id: g.id,
          season: 2025,
          week,
          startTime: new Date(g.startTime) as any,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          winnerTeam: null,
          status: 'scheduled',
        } as any).onConflictDoUpdate({
          target: games.id,
          set: {
            season: 2025,
            week,
            startTime: new Date(g.startTime) as any,
            homeTeam: g.homeTeam,
            awayTeam: g.awayTeam,
            status: 'scheduled',
            winnerTeam: null,
          },
        });
      }
      inserted.push({ week, count: list.length });
    }

    return NextResponse.json({ ok: true, season: 2025, results: inserted });
  } catch (e: any) {
    console.error('seed-2025-manual error:', e);
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 });
  }
}

