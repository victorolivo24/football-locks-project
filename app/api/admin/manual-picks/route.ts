export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { games, picks, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { isSameTeam } from '@/lib/teams';

interface IncomingPick {
  team?: string;
  pickedTeam?: string;
  gameId?: number | string;
}

type PickInput = IncomingPick | string;

export async function POST(req: NextRequest) {
  try {
    const pass = req.headers.get('x-admin-pass');
    if (pass !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: 'forbidden (bad admin pass)' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const season = Number(body?.season);
    const week = Number(body?.week);
    const userName: string | undefined = body?.user ?? body?.userName;
    const picksInput: PickInput[] | undefined = body?.picks;
    const overwrite: boolean = body?.overwrite !== false;

    if (!Number.isFinite(season) || !Number.isFinite(week)) {
      return NextResponse.json({ error: 'season & week required (numbers)' }, { status: 400 });
    }
    if (!userName) {
      return NextResponse.json({ error: 'user name is required' }, { status: 400 });
    }
    if (!Array.isArray(picksInput) || picksInput.length === 0) {
      return NextResponse.json({ error: 'picks array required' }, { status: 400 });
    }

    const userRow = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.name, userName))
      .limit(1)
      .then((rows) => rows[0]);

    if (!userRow) {
      return NextResponse.json({ error: `user '${userName}' not found` }, { status: 404 });
    }

    const weekGames = await db
      .select({
        id: games.id,
        homeTeam: games.homeTeam,
        awayTeam: games.awayTeam,
        season: games.season,
        week: games.week,
      })
      .from(games)
      .where(and(eq(games.season, season), eq(games.week, week)));

    if (weekGames.length === 0) {
      return NextResponse.json({ error: 'no games for requested season/week' }, { status: 404 });
    }

    const resolved: Array<{ gameId: number; pickedTeam: string }> = [];
    const issues: Array<{ input: IncomingPick; reason: string }> = [];
    const seenGameIds = new Set<number>();

    for (const entry of picksInput) {
      const pick: IncomingPick =
        typeof entry === 'string' ? { team: entry } : entry ?? {};
      const rawTeam = pick.team ?? pick.pickedTeam;
      const rawGameId = pick.gameId !== undefined ? Number(pick.gameId) : undefined;

      let gameMatch = undefined as (typeof weekGames)[number] | undefined;
      let resolvedTeam = undefined as string | undefined;

      if (Number.isFinite(rawGameId)) {
        gameMatch = weekGames.find((g) => Number(g.id) === rawGameId);
        if (!gameMatch) {
          issues.push({ input: pick, reason: `gameId ${rawGameId} not found for week` });
          continue;
        }
        if (!rawTeam) {
          issues.push({ input: pick, reason: 'team is required when using gameId' });
          continue;
        }
        if (isSameTeam(rawTeam, gameMatch.homeTeam)) {
          resolvedTeam = gameMatch.homeTeam;
        } else if (isSameTeam(rawTeam, gameMatch.awayTeam)) {
          resolvedTeam = gameMatch.awayTeam;
        } else {
          issues.push({ input: pick, reason: `team '${rawTeam}' not playing in specified game` });
          continue;
        }
      } else {
        if (!rawTeam) {
          issues.push({ input: pick, reason: 'team is required' });
          continue;
        }
        gameMatch = weekGames.find(
          (g) => isSameTeam(rawTeam, g.homeTeam) || isSameTeam(rawTeam, g.awayTeam)
        );
        if (!gameMatch) {
          issues.push({ input: pick, reason: `no game found for team '${rawTeam}' in week` });
          continue;
        }
        resolvedTeam = isSameTeam(rawTeam, gameMatch.homeTeam)
          ? gameMatch.homeTeam
          : gameMatch.awayTeam;
      }

      const gameIdNumber = Number(gameMatch.id);
      if (seenGameIds.has(gameIdNumber)) {
        issues.push({ input: pick, reason: 'duplicate game in request' });
        continue;
      }
      seenGameIds.add(gameIdNumber);
      resolved.push({ gameId: gameIdNumber, pickedTeam: resolvedTeam });
    }

    if (resolved.length === 0) {
      return NextResponse.json({ error: 'no valid picks resolved', details: issues }, { status: 400 });
    }

    let deleted = 0;
    if (overwrite) {
      deleted = await db
        .delete(picks)
        .where(
          and(
            eq(picks.userId, userRow.id),
            eq(picks.season, season),
            eq(picks.week, week)
          )
        )
        .returning({ gameId: picks.gameId })
        .then((rows) => rows.length);
    } else {
      const existing = await db
        .select({ gameId: picks.gameId })
        .from(picks)
        .where(
          and(
            eq(picks.userId, userRow.id),
            eq(picks.season, season),
            eq(picks.week, week)
          )
        );
      const existingIds = new Set(existing.map((e) => Number(e.gameId)));
      const filtered: typeof resolved = [];
      let skipped = 0;
      for (const item of resolved) {
        if (existingIds.has(item.gameId)) {
          skipped += 1;
        } else {
          filtered.push(item);
        }
      }
      if (skipped > 0) {
        issues.push({ input: {}, reason: `${skipped} picks already existed for this user/week` });
      }
      resolved.splice(0, resolved.length, ...filtered);
      if (resolved.length === 0) {
        return NextResponse.json({ ok: true, inserted: 0, skipped: true, issues }, { status: 200 });
      }
    }

    const toInsert = resolved.map((r) => ({
      userId: userRow.id,
      gameId: r.gameId,
      pickedTeam: r.pickedTeam,
      season,
      week,
    }));

    await db.insert(picks).values(toInsert);

    return NextResponse.json({
      ok: true,
      user: userRow.name,
      season,
      week,
      inserted: toInsert.length,
      overwritten: overwrite ? deleted : undefined,
      issues,
    });
  } catch (e: any) {
    console.error('manual-picks error:', e);
    return NextResponse.json({ error: e?.message ?? 'internal error' }, { status: 500 });
  }
}
