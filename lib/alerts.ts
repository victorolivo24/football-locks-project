import { isSameTeam, normalizeTeam } from './teams';
import type { AlertKind, PushMessage } from './push';
import { bustQuip, hitQuip, ownQuip, startQuip, sweatQuip, closer, QuipContext } from './quips';
import { DateTime } from 'luxon';

export interface GameState {
  id: number;
  startTime?: Date | string | null;
  homeTeam: string;
  awayTeam: string;
  status: string;
  winnerTeam: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeWinLow?: number | null;
  homeWinHigh?: number | null;
}

/** Win probability a lock has to fall under before anyone is told it is in trouble. */
export const SWEAT_LINE = 0.25;

export interface PickRow {
  userId: number;
  gameId: number | null;
  pickedTeam: string;
}

export interface Player {
  id: number;
  name: string;
}

/**
 * Turn a change in the board into the alerts it should produce.
 *
 * Driven by transitions rather than current state, so a result only ever
 * announces itself once no matter how often the refresh runs. Callers pass the
 * games as they were before the refresh and as they are after.
 */
/** "Ryan", "Ryan and David", "Ryan, David and Chris" */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function buildAlerts(
  before: GameState[],
  after: GameState[],
  picks: PickRow[],
  players: Player[],
  url: string
): PushMessage[] {
  const previous = new Map(before.map(g => [Number(g.id), g]));
  const current = new Map(after.map(g => [Number(g.id), g]));
  // First names only: these are read on a lock screen, and "Dakota Racine
  // needed 2 games to go right" reads like a court summons.
  const nameOf = new Map(players.map(p => [p.id, p.name.trim().split(/\s+/)[0]]));
  const messages: PushMessage[] = [];

  // All or nothing: one miss kills the week, so anyone already carrying a loss
  // is out and nothing further about their locks is worth sending — not to
  // them, not to anyone else. Seeded from the state before this refresh and
  // extended as busts land, so a bust still announces itself once.
  const out = new Set<number>();
  for (const pick of picks) {
    const settled = previous.get(Number(pick.gameId));
    if (!settled || settled.status !== 'final') continue;
    // A tie counts as a miss, matching how the week is scored.
    if (!settled.winnerTeam || !isSameTeam(settled.winnerTeam, pick.pickedTeam)) {
      out.add(pick.userId);
    }
  }

  const add = (userId: number, kind: AlertKind, title: string, body: string, tag: string) =>
    messages.push({ userId, kind, title, body, url, tag });

  for (const game of after) {
    const gameId = Number(game.id);
    const was = previous.get(gameId);
    if (!was) continue;

    const matchup = `${normalizeTeam(game.awayTeam)} @ ${normalizeTeam(game.homeTeam)}`;
    const backers = picks.filter(p => Number(p.gameId) === gameId);

    // Kickoff: only the people with something riding on it.
    if (was.status === 'scheduled' && game.status !== 'scheduled') {
      for (const pick of backers) {
        if (out.has(pick.userId)) continue;
        add(
          pick.userId,
          'gameStart',
          startQuip({
            who: 'you',
            plural: false,
            team: normalizeTeam(pick.pickedTeam),
            margin: null,
            earlyWeek: false,
            lockCount: null,
            survivors: null,
            locksHit: null,
            seed: `start:${gameId}:${pick.userId}`,
          }),
          `${matchup} just kicked off. You have ${normalizeTeam(pick.pickedTeam)}. ${closer(`start:${gameId}:${pick.userId}`)}`,
          `start:${gameId}`
        );
      }
    }

    // Close calls. A lock falling under the sweat line mid-game, and a lock
    // that fell under it but won anyway. The low only ever drops, so each
    // crossing is seen once however often the refresh runs.
    const lowFor = (g: GameState, homeSide: boolean): number | null =>
      homeSide ? g.homeWinLow ?? null : (g.homeWinHigh == null ? null : 1 - g.homeWinHigh);

    for (const side of [game.homeTeam, game.awayTeam]) {
      const homeSide = side === game.homeTeam;
      const low = lowFor(game, homeSide);
      if (low === null || low >= SWEAT_LINE) continue;

      const prevLow = lowFor(was, homeSide);
      const sweating = game.status === 'in_progress' && (prevLow === null || prevLow >= SWEAT_LINE);
      const survived = was.status !== 'final' && game.status === 'final'
        && !!game.winnerTeam && isSameTeam(game.winnerTeam, side);
      if (!sweating && !survived) continue;

      const sideBackers = backers
        .filter(p => !out.has(p.userId) && isSameTeam(p.pickedTeam, side))
        .map(p => p.userId);
      if (sideBackers.length === 0) continue;

      const team = normalizeTeam(side);
      const pct = Math.round(low * 100);
      const state = survived ? `came back from ${pct}% to win` : `are down to ${pct}% to win`;

      for (const player of players) {
        const own = sideBackers.includes(player.id);
        const names = sideBackers.filter(id => id !== player.id)
          .map(id => nameOf.get(id)).filter(Boolean) as string[];
        if (!own && names.length === 0) continue;

        const who = own ? 'you' : listNames(names);
        const seed = `${survived ? 'comeback' : 'sweat'}:${gameId}:${team}:${player.id}`;
        const title = sweatQuip({
          who, plural: !own && names.length > 1, team, margin: null, earlyWeek: false,
          lockCount: null, survivors: null, locksHit: null, seed,
        }, survived, own);
        const body = own
          ? `The ${team} ${state}. You have them. ${closer(seed)}`
          : `The ${team} ${state}. ${who} ${names.length > 1 ? 'have' : 'has'} them. ${closer(seed)}`;

        add(player.id, 'sweat', title, body, seed);
      }
    }

    // Final: tell the backers how theirs went, and everyone else how the
    // others' went — that is the part worth reading on a Sunday.
    if (was.status !== 'final' && game.status === 'final' && game.winnerTeam) {
      const score = game.awayScore != null && game.homeScore != null
        ? ` ${normalizeTeam(game.awayTeam)} ${game.awayScore}–${normalizeTeam(game.homeTeam)} ${game.homeScore}.`
        : '';

      const hits: number[] = [];
      const busts: number[] = [];

      const margin = game.awayScore != null && game.homeScore != null
        ? Math.abs(game.awayScore - game.homeScore)
        : null;

      // Thursday and Friday games end the week before it really begins.
      const weekday = game.startTime
        ? DateTime.fromJSDate(new Date(game.startTime)).setZone('America/New_York').weekday
        : 0;
      const earlyWeek = weekday === 4 || weekday === 5;

      const context = (
        who: string,
        plural: boolean,
        team: string,
        seed: string,
        lockCount: number | null = null,
        survivors: number | null = null,
        locksHit: number | null = null
      ): QuipContext =>
        ({ who, plural, team: normalizeTeam(team), margin, earlyWeek, lockCount, survivors, locksHit, seed });

      /** How many locks one player put up this week. */
      const locksFor = (userId: number) => picks.filter(p => p.userId === userId).length;

      /** How many of their locks have landed so far, counting this result. */
      const hitsFor = (userId: number) => picks.filter(p => {
        if (p.userId !== userId) return false;
        const settled = current.get(Number(p.gameId));
        return !!settled && settled.status === 'final' && !!settled.winnerTeam
          && isSameTeam(settled.winnerTeam, p.pickedTeam);
      }).length;

      for (const pick of backers) {
        if (out.has(pick.userId)) continue;

        const hit = isSameTeam(game.winnerTeam, pick.pickedTeam);
        (hit ? hits : busts).push(pick.userId);

        add(
          pick.userId,
          'gameFinal',
          ownQuip(
            context('you', false, pick.pickedTeam, `own:${gameId}:${pick.userId}`, locksFor(pick.userId)),
            hit
          ),
          `${normalizeTeam(pick.pickedTeam)} ${hit ? 'won' : 'lost'}.${score} ${closer(`own:${gameId}:${pick.userId}`)}`,
          `final:${gameId}:${pick.userId}`
        );
      }

      // Their week ends here, so later games say nothing about them.
      for (const userId of busts) out.add(userId);

      // Anyone who submitted and is not yet eliminated.
      const survivors = Array.from(new Set(picks.map(p => p.userId)))
        .filter(id => !out.has(id)).length;

      // One message per person per game, naming everyone it applies to.
      // Sending one per rival pick instead would mean a game six people
      // locked fires thirty notifications, and this league picks alike.
      const rivalNote = (
        affected: number[],
        kind: AlertKind,
        line: (c: QuipContext) => string,
        detail: (who: string, seed: string) => string
      ) => {
        for (const player of players) {
          const others = affected.filter(id => id !== player.id);
          if (others.length === 0) continue;

          const names = others.map(id => nameOf.get(id)).filter(Boolean) as string[];
          const who = listNames(names);
          const team = picks.find(p => p.userId === others[0] && Number(p.gameId) === gameId)?.pickedTeam ?? '';
          const seed = `${kind}:${gameId}:${player.id}`;
          // Lock counts only describe one person, so leave them out of a group line.
          const lockCount = others.length === 1 ? locksFor(others[0]) : null;
          const locksHit = others.length === 1 ? hitsFor(others[0]) : null;

          add(
            player.id,
            kind,
            line(context(who, names.length > 1, team, seed, lockCount, survivors, locksHit)),
            detail(who, seed),
            seed
          );
        }
      };

      rivalNote(
        hits,
        'rivalHit',
        hitQuip,
        (who, seed) => `${normalizeTeam(game.winnerTeam!)} won.${score} ${who} had it. ${closer(seed)}`
      );

      rivalNote(
        busts,
        'rivalBust',
        bustQuip,
        (who, seed) => `${normalizeTeam(game.winnerTeam!)} won.${score} ${who} lost that lock. ${closer(seed)}`
      );
    }
  }

  return messages;
}
