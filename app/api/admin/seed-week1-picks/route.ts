export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { games, picks, users } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { normalizeTeam, isSameTeam } from '@/lib/teams';

type SeedMap = Record<string, string[]>; // userName -> team nicknames or full names

const SEED_WEEK1: SeedMap = {
  Victor: ['Broncos', 'Eagles'],
  Jihoo: ['Eagles', 'Commanders', 'Broncos'],
  Ryan: ['Broncos', 'Cardinals'],
  Mihir: ['Eagles', 'Broncos', 'Cardinals'],
};

export async function POST(req: NextRequest) {
  try {
    const pass = req.headers.get('x-admin-pass');
    if (pass !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'forbidden (bad admin pass)' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as any));
    const season = Number(body?.season);
    const week = 1; // Hardcoded per request
    if (!Number.isFinite(season)) {
      return NextResponse.json({ error: 'season is required (number)' }, { status: 400 });
    }

    // Load week 1 games for the season
    const weekGames = await db.query.games.findMany({
      where: and(eq(games.season, season), eq(games.week, week)),
      orderBy: games.startTime,
    });

    if (weekGames.length === 0) {
      return NextResponse.json({ error: 'No games found for given season/week' }, { status: 404 });
    }

    // Load users so we can map names -> IDs
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userIdByName = new Map(allUsers.map((u) => [u.name, u.id] as const));

    const toInsert: Array<{ userId: number; gameId: number; pickedTeam: string; week: number; season: number }> = [];
    const missing: Array<{ user: string; team: string; reason: string }> = [];

    function findGameIdForTeam(teamName: string): { gameId: number; pickedTeam: string } | null {
      const norm = normalizeTeam(teamName);
      const g = weekGames.find(
        (g) => isSameTeam(norm, g.homeTeam) || isSameTeam(norm, g.awayTeam)
      );
      if (!g) return null;
      const pickedTeam = isSameTeam(norm, g.homeTeam) ? g.homeTeam : g.awayTeam;
      return { gameId: Number(g.id), pickedTeam };
    }

    for (const [name, teamsPicked] of Object.entries(SEED_WEEK1)) {
      const uid = userIdByName.get(name);
      if (!uid) {
        missing.push({ user: name, team: '-', reason: 'user not found' });
        continue;
      }
      for (const team of teamsPicked) {
        const match = findGameIdForTeam(team);
        if (!match) {
          missing.push({ user: name, team, reason: 'no matching game in week 1' });
          continue;
        }
        toInsert.push({ userId: uid, gameId: match.gameId, pickedTeam: match.pickedTeam, week, season });
      }
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: false, inserted: 0, missing });
    }

    // Avoid duplicates by removing ones that already exist
    const keys = toInsert.map((t) => ({ userId: t.userId, gameId: t.gameId }));
    const existing = await db
      .select({ userId: picks.userId, gameId: picks.gameId })
      .from(picks)
      .where(
        and(
          inArray(picks.userId, keys.map((k) => k.userId)),
          inArray(picks.gameId, keys.map((k) => k.gameId))
        )
      );

    const existsSet = new Set(existing.map((e) => `${e.userId}-${e.gameId}`));
    const filtered = toInsert.filter((t) => !existsSet.has(`${t.userId}-${t.gameId}`));

    if (filtered.length > 0) {
      await db.insert(picks).values(filtered as any);
    }

    return NextResponse.json({ ok: true, season, week, requested: toInsert.length, inserted: filtered.length, missing });
  } catch (e: any) {
    console.error('seed-week1-picks error:', e);
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 });
  }
}

