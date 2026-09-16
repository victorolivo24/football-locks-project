'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import AppShell, { PageHeader } from '@/components/AppShell';
import TeamLogo from '@/components/TeamLogo';
import { normalizeTeam, isSameTeam } from '@/lib/teams';
import { findGameForPick } from '@/lib/gameOdds';
import { sideWinChance, liveTicketChance, atLockChance } from '@/lib/luck';

interface Game {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  winnerTeam?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homeMoneyline?: number | null;
  awayMoneyline?: number | null;
  homeWinProb?: number | null;
  spread?: string | null;
  total?: number | null;
}

interface PickItem {
  gameId: number;
  pickedTeam: string;
}

interface UserRow { id: number; name: string }

const firstName = (name: string) => name.trim().split(/\s+/)[0];

/** Live games first, then upcoming by kickoff, finals last. */
const gameOrder = (g: Game) =>
  (g.status === 'in_progress' ? 0 : g.status === 'scheduled' ? 1 : 2) * 1e13 + new Date(g.startTime).getTime();

export default function LivePage({ params }: { params: { season: string; week: string } }) {
  const season = parseInt(params.season);
  const week = parseInt(params.week);

  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [picksByUser, setPicksByUser] = useState<Record<string, PickItem[]>>({});
  const [picksHidden, setPicksHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [schedRes, picksRes] = await Promise.all([
          fetch(`/api/schedule?season=${season}&week=${week}`),
          fetch(`/api/picks/all?season=${season}&week=${week}`),
        ]);
        if (schedRes.ok) setGames((await schedRes.json()).games || []);
        if (picksRes.ok) {
          const p = await picksRes.json();
          setPicksByUser(p.picksByUser || {});
          setUsers(p.users || []);
        } else {
          // Everyone's picks stay hidden until you submit your own.
          setPicksHidden(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [season, week]);

  // Poll whenever a game SHOULD have a result, not when the database already
  // says one is live: status only changes because a refresh wrote it.
  const needsPolling = games.some(
    (g) => g.status !== 'final' && new Date(g.startTime).getTime() <= Date.now()
  );

  useEffect(() => {
    if (!needsPolling) return;
    const tick = async () => {
      await fetch('/api/results/refresh', { method: 'POST' }).catch(() => undefined);
      const res = await fetch(`/api/schedule?season=${season}&week=${week}`).catch(() => null);
      if (res?.ok) setGames((await res.json()).games || []);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [needsPolling, season, week]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-display text-xl font-bold uppercase tracking-wide text-muted">Loading…</span>
      </div>
    );
  }

  const gameFor = (p: PickItem) => findGameForPick(p, games);
  const lost = (p: PickItem) => {
    const g = gameFor(p);
    return !!g && g.status === 'final' && !(g.winnerTeam && isSameTeam(g.winnerTeam, p.pickedTeam));
  };

  const tickets = users
    .map(u => {
      const ticket = picksByUser[u.name] || [];
      const out = ticket.some(lost);
      const legs = ticket.map(p => {
        const g = gameFor(p);
        return g ? sideWinChance(g, isSameTeam(p.pickedTeam, g.homeTeam)) : null;
      });
      const live = liveTicketChance(legs);
      return {
        user: u,
        ticket,
        out,
        cashed: ticket.length > 0 && !out && live === 1,
        live,
        atLock: atLockChance(ticket, games),
      };
    })
    .filter(t => t.ticket.length > 0)
    .sort((a, b) => Number(a.out) - Number(b.out) || (b.live ?? -1) - (a.live ?? -1));

  const liveCount = games.filter(g => g.status === 'in_progress').length;

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Season ${season} · Week ${week}`}
        title="Live"
        right={
          liveCount > 0
            ? <span className="tag-live text-xs"><span className="live-dot" /> {liveCount} live</span>
            : <span className="tag-muted text-xs">No games live</span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Live tickets */}
        <aside className="order-first space-y-2 lg:order-none lg:col-start-3 lg:row-start-1">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Tickets</h2>
            <span className="text-[11px] text-muted">
              <span className="text-live">live</span> · <span className="text-gold">at lock</span>
            </span>
          </div>

          {picksHidden ? (
            <div className="card p-4 text-sm text-muted">
              Submit your picks to see everyone&apos;s tickets.
              <Link href={`/week/${season}/${week}`} className="btn-primary mt-3 w-full">Make picks</Link>
            </div>
          ) : tickets.length === 0 ? (
            <div className="card p-4 text-sm text-muted">Nobody has submitted yet.</div>
          ) : (
            tickets.map(t => (
              <div key={t.user.id} className={`card flex items-center justify-between gap-3 px-3 py-2.5 ${t.out ? 'opacity-50' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{firstName(t.user.name)}</span>
                    {t.out && <span className="tag-loss">Out</span>}
                    {t.cashed && <span className="tag-win">Cashed</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.ticket.map(p => {
                      const g = gameFor(p);
                      const won = g?.status === 'final' && !!g.winnerTeam && isSameTeam(g.winnerTeam, p.pickedTeam);
                      const miss = lost(p);
                      const playing = g?.status === 'in_progress';
                      return (
                        <span
                          key={p.gameId}
                          title={normalizeTeam(p.pickedTeam)}
                          className={`rounded-full border p-0.5 ${
                            won ? 'border-win' : miss ? 'border-loss opacity-50' : playing ? 'border-live' : 'border-line'
                          }`}
                        >
                          <TeamLogo team={p.pickedTeam} size="sm" className="scale-75" />
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`num text-2xl font-bold leading-none ${
                    t.out ? 'text-muted' : t.cashed ? 'text-win' : 'text-live'
                  }`}>
                    {t.live === null ? '—' : `${Math.round(t.live * 100)}%`}
                  </div>
                  {t.atLock !== null && (
                    <div className="mt-0.5 text-[11px] text-gold">{Math.round(t.atLock * 100)}% at lock</div>
                  )}
                </div>
              </div>
            ))
          )}
        </aside>

        {/* Games */}
        <section className="space-y-2.5 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <h2 className="section-title">Games</h2>

          {[...games].sort((a, b) => gameOrder(a) - gameOrder(b)).map(g => {
            const live = g.status === 'in_progress';
            const final = g.status === 'final';

            // Everyone riding each side. Players already knocked out by a
            // different game stay listed but dimmed: their pick here no longer
            // decides anything, but hiding them made it look like nobody had it.
            const ridersOf = (team: string) => users
              .filter(u => (picksByUser[u.name] || [])
                .some(p => Number(p.gameId) === Number(g.id) && isSameTeam(p.pickedTeam, team)))
              .map(u => ({
                user: u,
                outElsewhere: (picksByUser[u.name] || [])
                  .some(p => Number(p.gameId) !== Number(g.id) && lost(p)),
              }));

            const side = (team: string, score: number | null | undefined, prob: number | null) => {
              const won = final && !!g.winnerTeam && isSameTeam(g.winnerTeam, team);
              const riders = ridersOf(team);
              return (
                <div className={`flex-1 min-w-0 ${final && !won ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <TeamLogo team={team} size="sm" />
                    <span className="truncate font-display text-base font-bold uppercase sm:text-lg">{normalizeTeam(team)}</span>
                    {g.status !== 'scheduled' && score != null && (
                      <span className={`num ml-auto text-3xl font-bold ${won ? 'text-win' : ''}`}>{score}</span>
                    )}
                  </div>
                  {prob !== null && (
                    <div className={`mt-0.5 text-[11px] ${live ? 'text-live' : 'text-muted'}`}>
                      {Math.round(prob * 100)}% {live ? 'live' : final ? '' : 'at lock'}
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {riders.map(({ user: u, outElsewhere }) => (
                      <span
                        key={u.id}
                        title={outElsewhere ? 'Already out this week' : undefined}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          outElsewhere
                            ? 'bg-white/5 text-muted line-through'
                            : won ? 'bg-win-soft text-win' : final ? 'bg-loss-soft text-loss' : 'bg-white/5 text-text'
                        }`}
                      >
                        {firstName(u.name)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            };

            const homeChance = final ? null : sideWinChance(g, true);

            return (
              <div key={g.id} className={`card p-3 ${live ? 'border-live/40' : ''}`}>
                <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                  <span>
                    {DateTime.fromISO(g.startTime).setZone('America/New_York').toFormat('ccc h:mm a')}
                    {g.spread && ` · ${g.spread}`}
                  </span>
                  {live ? (
                    <span className="tag-live"><span className="live-dot" /> Live</span>
                  ) : final ? (
                    <span className="tag-muted">Final</span>
                  ) : (
                    <span className="tag-muted">Upcoming</span>
                  )}
                </div>

                <div className="flex gap-4">
                  {side(g.awayTeam, g.awayScore, homeChance === null ? null : 1 - homeChance)}
                  {side(g.homeTeam, g.homeScore, homeChance)}
                </div>

                {live && g.homeWinProb != null && (
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="bg-live" style={{ width: `${(1 - g.homeWinProb) * 100}%` }} />
                    <div className="flex-1 bg-white/25" />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
