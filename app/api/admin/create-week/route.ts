export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { games } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

type NewGame = {
    id: number | string;
    startTime: string; // ISO
    homeTeam: string;
    awayTeam: string;
};

export async function POST(req: NextRequest) {
    try {
        const pass = req.headers.get('x-admin-pass');
        if (pass !== process.env.ADMIN_PASSCODE) {
            return NextResponse.json({ error: 'forbidden (bad admin pass)' }, { status: 403 });
        }

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
        }

        const { season, week, games: list } = body as { season?: number; week?: number; games?: NewGame[] };
        if (!season || !week) return NextResponse.json({ error: 'season & week required' }, { status: 400 });
        if (!Array.isArray(list) || list.length === 0) return NextResponse.json({ error: 'games[] required' }, { status: 400 });

        const rows = [];
        for (let i = 0; i < list.length; i++) {
            const g = list[i];
            if (!g) return NextResponse.json({ error: `games[${i}] missing` }, { status: 400 });
            const idNum = Number(g.id);
            if (!Number.isFinite(idNum)) return NextResponse.json({ error: `games[${i}].id must be a number` }, { status: 400 });
            if (!g.startTime || !g.homeTeam || !g.awayTeam) return NextResponse.json({ error: `games[${i}] missing fields` }, { status: 400 });
            const d = new Date(g.startTime);
            if (isNaN(d.getTime())) return NextResponse.json({ error: `games[${i}].startTime invalid ISO` }, { status: 400 });

            rows.push({
                id: idNum,
                season,
                week,
                startTime: d as any,
                homeTeam: String(g.homeTeam),
                awayTeam: String(g.awayTeam),
                status: 'scheduled' as const,
                winnerTeam: null as string | null,
            });
        }

        for (const r of rows) {
            await db.insert(games).values(r as any).onConflictDoUpdate({
                target: games.id,
                set: {
                    season: r.season, week: r.week, startTime: r.startTime as any,
                    homeTeam: r.homeTeam, awayTeam: r.awayTeam, status: r.status, winnerTeam: r.winnerTeam,
                },
            });
        }

        const inserted = await db.query.games.findMany({ where: and(eq(games.season, season!), eq(games.week, week!)) });
        return NextResponse.json({ ok: true, season, week, count: inserted.length });
    } catch (e: any) {
        console.error('create-week error:', e);
        return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 });
    }
}
