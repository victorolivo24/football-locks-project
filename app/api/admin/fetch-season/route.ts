export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { fetchNFLSchedule, upsertGames } from '@/lib/nfl';

type ReqBody = {
  season?: number;
  weeks?: number[]; // optional explicit weeks list; defaults to 1..18
};

export async function POST(req: NextRequest) {
  try {
    const pass = req.headers.get('x-admin-pass');
    if (pass !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'forbidden (bad admin pass)' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const season = Number(body.season);
    if (!Number.isFinite(season)) {
      return NextResponse.json({ error: 'season required' }, { status: 400 });
    }

    const weeks: number[] = Array.isArray(body.weeks) && body.weeks.length
      ? body.weeks.map(Number).filter((w) => Number.isFinite(w) && w >= 1 && w <= 18)
      : Array.from({ length: 18 }, (_, i) => i + 1);

    const results: { week: number; count: number }[] = [];

    for (const week of weeks) {
      const list = await fetchNFLSchedule(season, week);
      if (list.length > 0) {
        await upsertGames(list);
      }
      results.push({ week, count: list.length });
    }

    return NextResponse.json({ ok: true, season, totalWeeks: weeks.length, results });
  } catch (e: any) {
    console.error('fetch-season error:', e);
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 });
  }
}

