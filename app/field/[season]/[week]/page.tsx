'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell, { PageHeader } from '@/components/AppShell';
import PickBoard, { Selection } from '@/components/PickBoard';
import TeamLogo from '@/components/TeamLogo';
import { rankedBoard, ticketProbability, expectedPoints } from '@/lib/luck';
import { isSameTeam } from '@/lib/teams';
import { predictRanks, rankTickets, titleOddsAfterWeek, explainLocks, ticketFacts, Leg, WeekPlayer } from '@/lib/rivals';

interface Game {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  homeMoneyline?: number | null;
  awayMoneyline?: number | null;
}

/** The slice of /api/odds a rival's guess and the season simulation need. */
interface FieldPlayer {
  userId: number;
  name: string;
  points: number;
  simulatedPace: number;
  winProb: number;
  correlation: number;
  rankShares: number[];
}

const toSelection = (picks: Array<{ gameId: number; pickedTeam: string }>): Selection => {
  const picked: Selection = {};
  for (const pick of picks) picked[Number(pick.gameId)] = pick.pickedTeam;
  return picked;
};

/**
 * Pick against the field: set what you expect everyone else to lock, and see
 * which of your own tickets gives you the best title chance once this week
 * is played. Rivals' tickets are always guesses from their tendencies, never
 * their real picks, so nothing here depends on who has submitted.
 */
export default function FieldPage({ params }: { params: { season: string; week: string } }) {
  const season = parseInt(params.season);
  const week = parseInt(params.week);
  const router = useRouter();

  const [meId, setMeId] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [myPicks, setMyPicks] = useState<Selection>({});
  const [field, setField] = useState<{ players: FieldPlayer[]; remainingWeeks: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch('/api/me');
        if (!me.ok) return router.push('/login');
        setMeId((await me.json()).user.userId);

        const [schedRes, picksRes, oddsRes] = await Promise.all([
          fetch(`/api/schedule?season=${season}&week=${week}`),
          fetch(`/api/picks/my?season=${season}&week=${week}`),
          fetch(`/api/odds?season=${season}&week=${week}`, { cache: 'no-store' }),
        ]);
        if (schedRes.ok) setGames((await schedRes.json()).games || []);
        if (picksRes.ok) setMyPicks(toSelection((await picksRes.json()).picks || []));
        if (oddsRes.ok) {
          const data = await oddsRes.json();
          setField({ players: data.odds, remainingWeeks: data.remainingWeeks });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [season, week, router]);

  const board = useMemo(() => rankedBoard(games), [games]);
  const gameById = useMemo(() => new Map(games.map(g => [Number(g.id), g])), [games]);
  const rivals = useMemo(() => (field?.players ?? []).filter(p => p.userId !== meId), [field, meId]);

  // Each rival's guessed ticket: as many games as they usually take, on the
  // board ranks they take most often.
  const guesses = useMemo(() => {
    const out: Record<number, Selection> = {};
    for (const rival of rivals) {
      const ticket: Selection = {};
      for (const rank of predictRanks(rival.rankShares, rival.simulatedPace)) {
        const entry = board[rank];
        if (entry) ticket[entry.game.id] = entry.homeProbability >= 0.5 ? entry.game.homeTeam : entry.game.awayTeam;
      }
      out[rival.userId] = ticket;
    }
    return out;
  }, [rivals, board]);

  const [tickets, setTickets] = useState<Record<number, Selection>>({});
  useEffect(() => setTickets(guesses), [guesses]);

  const [mine, setMine] = useState<Selection>({});
  useEffect(() => setMine(myPicks), [myPicks]);

  const [editing, setEditing] = useState<number | null>(null);
  const editingId = editing ?? meId;
  const editingMe = editingId === meId;
  const current = editingMe ? mine : tickets[editingId ?? -1] ?? {};

  const toggle = (gameId: number, team: string) => {
    const update = (ticket: Selection) => {
      const next = { ...ticket };
      if (next[gameId] === team) delete next[gameId];
      else next[gameId] = team;
      return next;
    };
    if (editingMe) setMine(update);
    else setTickets(all => ({ ...all, [editingId!]: update(all[editingId!] ?? {}) }));
  };

  const toLegs = (ticket: Selection): Leg[] =>
    Object.entries(ticket).flatMap(([gameId, team]) => {
      const game = gameById.get(Number(gameId));
      return game ? [{ gameId: Number(gameId), home: isSameTeam(team, game.homeTeam) }] : [];
    });

  // Rank my options against the field, by title chance once this week is played.
  const against = useMemo(() => {
    if (!field || meId === null || !field.players.some(p => p.userId === meId)) return null;

    const homeProb = new Map(board.map(e => [e.game.id, e.homeProbability]));
    const favourites: Leg[] = board.slice(0, 8).map(e => ({ gameId: e.game.id, home: e.homeProbability >= 0.5 }));
    const players: WeekPlayer[] = field.players.map(p => ({
      userId: p.userId,
      points: p.points,
      size: p.simulatedPace,
      winProb: p.winProb,
      correlation: p.correlation,
      ticket: toLegs(p.userId === meId ? mine : tickets[p.userId] ?? {}),
    }));

    const index = players.findIndex(p => p.userId === meId);
    return {
      mine: titleOddsAfterWeek(players, homeProb, field.remainingWeeks)[index],
      ranked: rankTickets(meId, players, favourites, homeProb, field.remainingWeeks)
        .slice(0, 8)
        .map(row => ({ ...row, facts: ticketFacts(meId, players, row.ticket, homeProb) })),
      locks: explainLocks(meId, players, favourites, homeProb, field.remainingWeeks),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, board, mine, tickets, meId]);

  const load = (ticket: Leg[]) => {
    const next: Selection = {};
    for (const leg of ticket) {
      const game = gameById.get(leg.gameId);
      if (game) next[leg.gameId] = leg.home ? game.homeTeam : game.awayTeam;
    }
    setMine(next);
    setEditing(meId);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-display text-xl font-bold uppercase tracking-wide text-muted">Sizing up the field…</span>
      </div>
    );
  }

  const chosen = board.filter(entry => current[entry.game.id]);
  const probabilities = chosen.map(entry =>
    current[entry.game.id] === entry.game.homeTeam ? entry.homeProbability : entry.awayProbability
  );
  const survives = ticketProbability(probabilities) * 100;
  const expected = expectedPoints(probabilities);

  const editingName = editingMe ? 'Your' : `${rivals.find(r => r.userId === editingId)?.name.split(' ')[0]}'s`;
  const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

  const stat = (label: string, value: string, tone = '') => (
    <div className="rounded-lg bg-raised py-2.5 text-center">
      <div className={`num text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );

  const names = (ids: number[]) =>
    ids.map(id => rivals.find(r => r.userId === id)?.name.split(' ')[0]).filter(Boolean).join(', ');

  const logos = (ticket: Leg[]) => (
    <div className="flex -space-x-1">
      {ticket.map(leg => {
        const game = gameById.get(leg.gameId);
        return game && <TeamLogo key={leg.gameId} team={leg.home ? game.homeTeam : game.awayTeam} size="sm" className="scale-75" />;
      })}
    </div>
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Season ${season} · Week ${week}`}
        title="Vs. the Field"
        right={<Link href={`/week/${season}/${week}`} className="btn-ghost px-3 py-2 text-xs">← Week {week}</Link>}
      />

      {board.length === 0 ? (
        <div className="card px-4 py-10 text-center text-muted">No lines for this week yet.</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Tickets */}
          <section className="card space-y-3 p-4 lg:col-span-2">
            <p className="text-xs text-muted">
              Tap a name, then set the ticket you expect from them. Rivals start on a guess from how many games
              they usually take and which; nothing here is their real picks.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {[{ userId: meId!, name: 'Me' }, ...rivals].map(p => (
                <button
                  key={p.userId}
                  onClick={() => setEditing(p.userId)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    editingId === p.userId ? 'border-gold bg-gold-soft font-semibold' : 'border-line bg-raised text-muted'
                  }`}
                >
                  {p.name.split(' ')[0]}
                  <span className="num ml-1.5 text-xs opacity-60">
                    {Object.keys(p.userId === meId ? mine : tickets[p.userId] ?? {}).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <h2 className="section-title">{editingName} ticket</h2>
              {editingMe ? (
                Object.keys(myPicks).length > 0 && JSON.stringify(mine) !== JSON.stringify(myPicks) && (
                  <button onClick={() => setMine(myPicks)} className="btn-ghost px-3 py-1.5 text-xs">Back to my picks</button>
                )
              ) : (
                <button
                  onClick={() => setTickets(all => ({ ...all, [editingId!]: Object.keys(current).length ? {} : guesses[editingId!] ?? {} }))}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  {Object.keys(current).length ? 'Clear' : 'Use guess'}
                </button>
              )}
            </div>

            {!editingMe && (() => {
              const rival = rivals.find(r => r.userId === editingId);
              if (!rival) return null;
              const chalk = Math.round((rival.rankShares[0] ?? 0) * 100);
              return (
                <p className="text-xs text-muted">
                  Guess: {rival.simulatedPace} {rival.simulatedPace === 1 ? 'lock' : 'locks'}, the way they usually play.
                  They take the safest game on the board {chalk}% of weeks, and sit {rival.points} pts.
                </p>
              );
            })()}

            <div className="grid grid-cols-3 gap-2">
              {stat('Locks', String(chosen.length))}
              {stat('Hits all', chosen.length > 0 ? `${survives.toFixed(1)}%` : '—', 'text-gold')}
              {stat('Exp. points', chosen.length > 0 ? expected.toFixed(2) : '—')}
            </div>

            <PickBoard board={board} selection={current} onToggle={toggle} />
          </section>

          {/* Ranking */}
          <aside className="order-first space-y-2 lg:order-none">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Your best plays</h2>
              <span className="text-[11px] text-muted">title odds after this week</span>
            </div>
            {!against ? (
              <div className="card p-4 text-sm text-muted">No standings to play against yet.</div>
            ) : (
              <div className="card space-y-2 p-4">
                <div className="flex items-center justify-between rounded-lg bg-gold-soft px-3 py-2">
                  <span className="text-sm">Your ticket as set</span>
                  <span className="num text-xl font-bold text-gold">{pct(against.mine)}</span>
                </div>
                <div className="space-y-1">
                  {against.ranked.map(row => (
                    <button
                      key={row.ticket.map(l => l.gameId).join('-')}
                      onClick={() => load(row.ticket)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2 text-left hover:bg-white/5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="num w-5 text-[10px] text-muted">{row.ticket.length}×</span>
                          {logos(row.ticket)}
                        </div>
                        {row.facts && (
                          <p className="mt-1 text-[11px] leading-snug text-muted">
                            Hits {Math.round(row.facts.hitChance * 100)}% of the time, +{row.ticket.length} to {row.facts.pointsIfHit} pts on the season:{' '}
                            {row.facts.notClearOf.length === 0
                              ? 'clear of the field even if everyone hits.'
                              : `not clear of ${names(row.facts.notClearOf)} if theirs hit too.`}
                            {row.facts.same.length > 0 && ` Same ticket as ${names(row.facts.same)}, so you move together.`}
                            {row.facts.extends.map(e =>
                              ` ${names([e.userId])}'s ticket plus ${e.extra}: all hit and you gain ${e.extra} on them, your extra${e.extra === 1 ? '' : 's'} bust and they gain ${e.theirs}.`
                            ).join('')}
                            {row.facts.clearOf.length > 0 && ` Shares nothing with ${names(row.facts.clearOf)}, so their bust is pure gain.`}
                          </p>
                        )}
                      </div>
                      <span className="num shrink-0 text-sm font-bold">{pct(row.odds)}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">
                  Subsets of the safest eight games, given the tickets you set for everyone else. Tap one to
                  make it your ticket here.
                </p>
              </div>
            )}

            {against && (
              <div className="card space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="section-title">Game by game</h2>
                  <span className="text-[11px] text-muted">swing in your title odds</span>
                </div>
                <div className="divide-y divide-line">
                  {against.locks.map(lock => {
                    const game = gameById.get(lock.leg.gameId);
                    if (!game) return null;
                    const team = lock.leg.home ? game.homeTeam : game.awayTeam;
                    const swing = lock.delta * 100;
                    return (
                      <div key={lock.leg.gameId} className="flex items-center gap-2 py-2">
                        <TeamLogo team={team} size="sm" className="scale-75" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <span className="truncate font-semibold">{team.split(' ').pop()}</span>
                            {lock.held && <span className="text-[10px] text-gold">🔒</span>}
                          </div>
                          <div className="text-[11px] text-muted">
                            hits → {pct(lock.ifHits)} · misses → {pct(lock.ifMisses)}
                          </div>
                          <div className="text-[11px] text-muted">
                            {lock.with.length === 0 && lock.against.length === 0
                              ? 'Nobody else on it: a miss is yours alone.'
                              : [
                                  lock.with.length > 0 && `With ${names(lock.with)}`,
                                  lock.against.length > 0 && `fading ${names(lock.against)}`,
                                ].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <span className={`num shrink-0 text-sm font-bold ${swing > 0.05 ? 'text-win' : swing < -0.05 ? 'text-loss' : 'text-muted'}`}>
                          {swing > 0 ? '+' : ''}{swing.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted">
                  Each line: what locking this game does to your title odds, added to your ticket as set (or
                  what a 🔒 you already hold is worth). A game your rivals share can&apos;t hurt you much if it
                  misses, since they bust with you. One only you hold can.
                </p>
              </div>
            )}

            <details className="card p-4 text-sm text-muted">
              <summary className="section-title cursor-pointer">How this works</summary>
              <ul className="mt-3 list-disc space-y-1.5 pl-4">
                <li>
                  Expected points scores a ticket on its own. It ignores that the leader only needs to hold serve
                  and the pack needs to catch up.
                </li>
                <li>
                  So each play is scored by your chance of winning the season once this week is played: every way
                  the week can go, weighted by the lines, then the remaining weeks simulated from each result.
                </li>
                <li>
                  Everyone on the same game lives or dies on the same result. Sharing the leader&apos;s games means
                  you can never gain on them; fading them means you can.
                </li>
                <li>
                  A rival&apos;s guess is how many games they usually lock, placed on the board ranks they take most
                  often this season. Change it if you know better, or clear it if you think they will sit out.
                </li>
                <li>
                  Plays are subsets of the safest eight games, one to six locks. Underdog sides are not searched.
                </li>
              </ul>
            </details>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
