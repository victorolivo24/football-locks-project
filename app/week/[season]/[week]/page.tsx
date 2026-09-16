'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { isPicksLocked, getLockTime } from '@/lib/nfl';
import AppShell, { PageHeader } from '@/components/AppShell';
import TeamLogo from '@/components/TeamLogo';
import TicketBuilder from '@/components/TicketBuilder';
import { isSameTeam, normalizeTeam } from '@/lib/teams';
import { fairWinProbability, slateProbabilities, evCurve, bestLockCount, atLockChance } from '@/lib/luck';

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
  spread?: string | null;
  total?: number | null;
}

interface Pick {
  gameId: number;
  pickedTeam: string;
}

interface User {
  name: string;
  userId: number;
}

const formatMl = (ml: number | null | undefined) => (ml == null ? '' : ml > 0 ? `+${ml}` : `${ml}`);

function countdown(to: DateTime): string {
  const diff = to.diff(DateTime.now().setZone('America/New_York'), ['days', 'hours', 'minutes']);
  if (diff.toMillis() <= 0) return 'Locked';
  if (diff.days > 0) return `${diff.days}d ${diff.hours}h`;
  if (diff.hours > 0) return `${diff.hours}h ${Math.floor(diff.minutes)}m`;
  return `${Math.max(1, Math.floor(diff.minutes))}m`;
}

export default function WeekPage({ params }: { params: { season: string; week: string } }) {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [myPicks, setMyPicks] = useState<Pick[]>([]);
  const [picks, setPicks] = useState<Array<{ gameId: number; team?: string }>>([]);
  const [league, setLeague] = useState<{ users: Array<{ id: number; name: string }>; picksByUser: Record<string, Pick[]> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [calcOpen, setCalcOpen] = useState(false);
  const [, setTick] = useState(0);
  const router = useRouter();

  const season = parseInt(params.season);
  const week = parseInt(params.week);
  const isLocked = isPicksLocked(season, week);
  const lockTime = getLockTime(season, week);
  const hasSubmitted = myPicks.length > 0;

  // Keep the countdown moving.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const calcSeed = useMemo(
    () => hasSubmitted
      ? myPicks
      : picks.filter(p => p.team).map(p => ({ gameId: p.gameId, pickedTeam: p.team! })),
    [hasSubmitted, myPicks, picks]
  );

  useEffect(() => {
    checkAuth();
    fetchData();
  }, [season, week]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  };

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

  const fetchData = async () => {
    try {
      const [gamesRes, picksRes, leagueRes] = await Promise.all([
        fetch(`/api/schedule?season=${season}&week=${week}`),
        fetch(`/api/picks/my?season=${season}&week=${week}`),
        fetch(`/api/picks/all?season=${season}&week=${week}`),
      ]);
      if (gamesRes.ok) setGames((await gamesRes.json()).games || []);
      if (picksRes.ok) setMyPicks((await picksRes.json()).picks || []);
      // Only readable once you have submitted your own.
      if (leagueRes.ok) {
        const data = await leagueRes.json();
        setLeague({ users: data.users || [], picksByUser: data.picksByUser || {} });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickChange = (gameId: number, pickedTeam: string) => {
    if (isLocked || hasSubmitted) return;
    setPicks(prev => {
      const existing = prev.find(p => p.gameId === gameId);
      const rest = prev.filter(p => p.gameId !== gameId);
      if (existing && existing.team === pickedTeam) return rest;
      return [...rest, { gameId, team: pickedTeam }];
    });
  };

  const handleSubmit = async () => {
    if (isLocked || hasSubmitted) return;
    const validPicks = picks.filter(p => !!p.team).map(p => ({ gameId: p.gameId, pickedTeam: p.team! }));
    if (validPicks.length === 0) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/picks/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ season, week, picks: validPicks }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      window.location.reload();
    } catch (err: any) {
      setError(`Submit failed: ${err.message}`);
      setSubmitting(false);
    }
  };

  const pickedTeamFor = (gameId: number) =>
    hasSubmitted
      ? myPicks.find(p => p.gameId === gameId)?.pickedTeam || ''
      : picks.find(p => p.gameId === gameId)?.team || '';

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-display text-xl font-bold uppercase tracking-wide text-muted">Loading week {week}…</span>
      </div>
    );
  }

  const draft = calcSeed;
  const draftChance = atLockChance(draft, games);
  const drafting = !isLocked && !hasSubmitted;

  // Sweet spot for this week's board, safest games first.
  const slateProbs = slateProbabilities(games);
  const curve = evCurve(slateProbs, 6);
  const bestN = bestLockCount(curve);

  const status = isLocked
    ? { tag: 'tag-muted', text: 'Locked' }
    : hasSubmitted
      ? { tag: 'tag-win', text: 'Submitted' }
      : { tag: 'tag-lock', text: `Locks in ${countdown(lockTime)}` };

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Season ${season}`}
        title={`Week ${week}`}
        right={
          <button onClick={() => setCalcOpen(true)} className="btn-ghost px-3 py-2 text-xs">
            🎛️ Ticket Simulator
          </button>
        }
      />

      <div className="card mb-5 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={status.tag}>{status.text}</span>
          <span className="text-sm text-muted">
            {isLocked ? 'Picks are closed for this week' : `Picks lock ${lockTime.toFormat("ccc h:mm a")} ET`}
          </span>
        </div>
        {hasSubmitted && draftChance !== null && (
          <span className="text-sm">
            Your {myPicks.length}-lock ticket: <span className="num text-lg font-bold text-gold">{Math.round(draftChance * 100)}%</span>
            <span className="ml-1 tag-lock">at lock</span>
          </span>
        )}
      </div>

      {error && <div className="card mb-4 border-loss/40 px-4 py-3 text-sm text-loss">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Matchups */}
        <section className="space-y-2.5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Matchups</h2>
            <span className="text-xs text-muted">
              {drafting ? 'Tap a team to lock it · tap again to undo' : `${games.length} games`}
            </span>
          </div>

          {games.length === 0 && <div className="card px-4 py-10 text-center text-muted">No games scheduled yet.</div>}

          {games.map((game) => {
            const picked = pickedTeamFor(game.id);
            const started = game.status !== 'scheduled';
            const editable = drafting && !started;
            const homeFair = game.homeMoneyline != null && game.awayMoneyline != null
              ? fairWinProbability(game.homeMoneyline, game.awayMoneyline)
              : null;

            const side = (team: string, ml: number | null | undefined, score: number | null | undefined, fair: number | null) => {
              const mine = !!picked && isSameTeam(picked, team);
              const won = game.status === 'final' && !!game.winnerTeam && isSameTeam(game.winnerTeam, team);
              const lost = game.status === 'final' && !won;
              return (
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => handlePickChange(game.id, team)}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    mine ? 'border-gold bg-gold-soft' : 'border-line bg-raised'
                  } ${editable ? 'hover:border-white/20' : 'cursor-default'} ${lost ? 'opacity-50' : ''}`}
                >
                  <TeamLogo team={team} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-display text-base font-bold uppercase leading-tight sm:text-lg ${mine ? 'text-gold' : 'text-text'}`}>
                      {normalizeTeam(team)}
                    </div>
                    <div className="text-[11px] text-muted">
                      {formatMl(ml)}{fair !== null && ` · ${Math.round(fair * 100)}%`}
                    </div>
                  </div>
                  {started && score != null ? (
                    <span className={`num shrink-0 text-2xl font-bold ${won ? 'text-win' : 'text-text'}`}>{score}</span>
                  ) : mine ? (
                    <span className="shrink-0 text-gold">🔒</span>
                  ) : null}
                </button>
              );
            };

            return (
              <div key={game.id} className="card p-2.5">
                <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-muted">
                  <span>
                    {DateTime.fromISO(game.startTime).setZone('America/New_York').toFormat('ccc h:mm a')}
                    {game.spread && ` · ${game.spread}`}
                    {game.total && ` · O/U ${game.total}`}
                  </span>
                  {game.status === 'final' ? (
                    <span className="tag-muted">Final</span>
                  ) : game.status === 'in_progress' ? (
                    <span className="tag-live"><span className="live-dot" /> Live</span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {side(game.awayTeam, game.awayMoneyline, game.awayScore, homeFair === null ? null : 1 - homeFair)}
                  {side(game.homeTeam, game.homeMoneyline, game.homeScore, homeFair)}
                </div>
              </div>
            );
          })}
        </section>

        {/* Sidebar */}
        <aside className={`space-y-5 ${drafting ? '' : 'order-first lg:order-none'}`}>
          {curve.length > 0 && (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">Sweet Spot</h2>
                <span className="tag-lock">at lock</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {curve.map(tier => (
                  <div
                    key={tier.n}
                    className={`rounded-xl border p-2 text-center ${
                      tier.n === bestN ? 'border-gold bg-gold-soft' : 'border-line bg-raised'
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase text-muted">{tier.n} {tier.n === 1 ? 'lock' : 'locks'}</div>
                    <div className={`num text-xl font-bold ${tier.n === bestN ? 'text-gold' : ''}`}>{tier.expected}</div>
                    <div className="text-[10px] text-muted">{Math.round(tier.probability)}% hits</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                Expected points by ticket size, taking the safest games first. <span className="text-gold">{bestN} locks</span> is
                the best play on this board.
              </p>
            </section>
          )}

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">League Tickets</h2>
              <span className="tag-lock">at lock</span>
            </div>
            {!league ? (
              <p className="text-sm text-muted">Submit your picks to see everyone else&apos;s.</p>
            ) : (
              <div className="space-y-2">
                {league.users
                  .map(u => ({ u, ticket: league.picksByUser[u.name] || [] }))
                  .map(row => ({ ...row, chance: atLockChance(row.ticket, games) }))
                  .sort((a, b) => (b.chance ?? -1) - (a.chance ?? -1))
                  .map(({ u, ticket, chance }) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-raised px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{u.name.split(' ')[0]}</div>
                        <div className="mt-0.5 flex -space-x-1">
                          {ticket.length === 0
                            ? <span className="text-[11px] text-muted">No picks</span>
                            : ticket.map(p => <TeamLogo key={p.gameId} team={p.pickedTeam} size="sm" className="scale-75" />)}
                        </div>
                      </div>
                      {chance !== null && (
                        <span className="num text-xl font-bold text-gold">{Math.round(chance * 100)}%</span>
                      )}
                    </div>
                  ))}
                <Link href={`/picks/${season}/${week}`} className="btn-ghost mt-1 w-full text-xs">
                  Follow them live →
                </Link>
              </div>
            )}
          </section>

          <details className="card p-4 text-sm text-muted">
            <summary className="section-title cursor-pointer">How scoring works</summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-4">
              <li>Lock as many games as you like before {lockTime.toFormat('ccc h:mm a')} ET.</li>
              <li>If every lock wins, you score one point per lock. One miss and the week is zero.</li>
              <li>A tie counts as a miss.</li>
              <li>You see everyone else&apos;s picks once you submit your own.</li>
            </ul>
          </details>
        </aside>
      </div>

      {/* Draft bar: sits above the phone tab bar while picking */}
      {drafting && draft.length > 0 && (
        <div className="fixed inset-x-0 bottom-[68px] z-20 px-4 md:bottom-4">
          <div className="card mx-auto flex max-w-2xl items-center justify-between gap-3 border-gold/40 bg-raised px-4 py-3 shadow-2xl">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{draft.length} {draft.length === 1 ? 'lock' : 'locks'}</div>
              {draftChance !== null && (
                <div className="text-xs text-muted">
                  <span className="font-semibold text-gold">{Math.round(draftChance * 100)}%</span> to hit at lock
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => setPicks([])} className="btn-ghost px-3 text-xs">Clear</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                {submitting ? 'Submitting…' : 'Submit picks'}
              </button>
            </div>
          </div>
        </div>
      )}

      {calcOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCalcOpen(false)} />
          <div className="relative h-full w-full max-w-md space-y-3 overflow-y-auto border-l border-line bg-ink p-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Ticket Simulator</h2>
              <button onClick={() => setCalcOpen(false)} className="btn-ghost px-3 py-1.5 text-xs">Close</button>
            </div>
            <TicketBuilder games={games} week={week} myPicks={calcSeed} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
