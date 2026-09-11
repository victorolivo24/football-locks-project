import { isSameTeam, normalizeTeam } from './teams';
import type { AlertKind, PushMessage } from './push';
import { bustQuip, hitQuip, ownQuip, QuipContext } from './quips';
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
}

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
  const nameOf = new Map(players.map(p => [p.id, p.name]));
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
          'Your lock is underway',
          `${matchup} just kicked off. You have ${normalizeTeam(pick.pickedTeam)}.`,
          `start:${gameId}`
        );
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
          `${normalizeTeam(pick.pickedTeam)} ${hit ? 'won' : 'lost'}.${score}`,
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
        detail: (who: string) => string
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
            detail(who),
            seed
          );
        }
      };

      rivalNote(
        hits,
        'rivalHit',
        hitQuip,
        who => `${normalizeTeam(game.winnerTeam!)} won.${score} ${who} had it.`
      );

      rivalNote(
        busts,
        'rivalBust',
        bustQuip,
        who => `${normalizeTeam(game.winnerTeam!)} won.${score} ${who} lost that lock.`
      );
    }
  }

  return messages;
}
