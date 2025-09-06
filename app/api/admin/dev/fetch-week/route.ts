export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { fetchNFLSchedule, upsertGames } from '@/lib/nfl';

function okToBypassAuth() {
    return process.env.NODE_ENV === 'development';
}

async function doFetch(req: NextRequest) {
    // minimal guard in prod
    const pass = req.headers.get('x-admin-pass');
    if (!okToBypassAuth() && pass !== process.env.ADMIN_PASSCODE) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const season = Number(searchParams.get('season'));
    const week = Number(searchParams.get('week'));
    if (!season || !week) {
        return NextResponse.json({ error: 'season & week required' }, { status: 400 });
    }

    const list = await fetchNFLSchedule(season, week);
    await upsertGames(list);
    return NextResponse.json({ season, week, inserted: list.length });
}

export async function POST(req: NextRequest) {
    return doFetch(req);
}

// allow GET in dev to make it trivial to trigger from the browser
export async function GET(req: NextRequest) {
    if (!okToBypassAuth()) {
        return NextResponse.json({ error: 'GET disabled in production' }, { status: 405 });
    }
    return doFetch(req);
}
