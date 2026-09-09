'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';
import TicketBuilder from './TicketBuilder';
import { PlayerInsights, SeasonInsightsData } from '@/lib/insights';
import { isSameTeam } from '@/lib/teams';
import { parlayForPicks, moneylineForPick, findGameForPick } from '@/lib/gameOdds';
import { slateProbabilities, evCurve, bestLockCount } from '@/lib/luck';

interface User {
  name: string;
  userId: number;
}

export default function NerdStatsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [insights, setInsights] = useState<SeasonInsightsData | null>(null);
  const [parlayPicks, setParlayPicks] = useState<{ userName: string; picks: any[] }[]>([]);
  const [parlayGames, setParlayGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<number>(2026);
  const [week, setWeek] = useState<number | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    checkAuth();
    const seasonParam = searchParams.get('season');
    // The slate section always tracks the live week, so the parlay board moves
    // on with the season instead of staying pinned to Week 1.
    fetch('/api/week')
      .then(res => res.json())
      .then(data => {
        if (!seasonParam && data.season) setSeason(data.season);
        if (data.week) setWeek(data.week);
      })
      .catch(() => setWeek(1));
    if (seasonParam) {
      setSeason(parseInt(seasonParam));
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && week !== null) {
      fetchInsights();
    }
  }, [user, season, week]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async () => {
    try {
      const [insightsRes, picksRes, schedRes] = await Promise.all([
        fetch(`/api/insights?season=${season}`),
        fetch(`/api/picks/all?season=${season}&week=${week}`),
        fetch(`/api/schedule?season=${season}&week=${week}`)
      ]);
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data);
      }
      if (picksRes.ok && schedRes.ok) {
        const pData = await picksRes.json();
        const sData = await schedRes.json();
        setParlayGames(sData.games || []);
        const userList = pData.users || [];
        const pByUser = pData.picksByUser || {};
        const list = userList.map((u: any) => ({
          userName: u.name,
          picks: pByUser[u.name] || [],
        })).filter((x: any) => x.picks.length > 0);
        setParlayPicks(list);
      }
    } catch (error) {
      console.error('Error fetching insights/picks:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white animate-pulse">Loading Nerd Stats & Insights...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const allPlayers = insights?.players || [];

  // Sweet spot for THIS week's board: walk the real sorted probabilities rather
  // than assuming every lock is as safe as the first.
  const slateProbs = slateProbabilities(parlayGames);
  const slateCurve = evCurve(slateProbs, 6);
  const bestN = bestLockCount(slateCurve);
  const marginalProb = slateProbs[bestN] ?? null; // the first lock that misses the cut

  return (
    <div className="min-h-screen pb-16">
      {/* Navigation */}
      <nav className="relative glass-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-black font-bold text-lg">🔒</span>
                </div>
                <span className="text-2xl font-bold text-white">NFL Locks</span>
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                href={`/scoreboard?season=${season}`}
                className="text-xs sm:text-sm font-semibold text-green-200 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
              >
                ← Back to Scoreboard
              </Link>
              <Link
                href="/"
                className="text-sm text-green-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-10">
        {/* Page Hero Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 px-4 sm:px-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-3xl">🤓</span>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Nerd Stats & Insights</h1>
            </div>
            <p className="text-green-200 text-sm mt-1">
              Season {season} • Deep dive into player tendencies, home/road splits, league superlatives, and sweet spot math.
            </p>
          </div>
          <Link
            href={`/scoreboard?season=${season}`}
            className="text-xs sm:text-sm font-bold text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 px-4 py-2 rounded-xl transition-colors self-start sm:self-auto"
          >
            📊 View Scoreboard
          </Link>
        </div>

        {/* Section 1: Weekly Slate Parlay Odds */}
        {parlayPicks.length > 0 && (
          <div className="space-y-3 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>🎲</span>
                <span>Week {week} Slate Parlay Odds</span>
              </h2>
              <span className="text-xs text-green-200/70">
                Real Vegas moneylines compounded into all-or-nothing parlay odds
              </span>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-left text-xs font-bold text-green-200 uppercase tracking-wider">
                      <th className="px-5 py-3">Player</th>
                      <th className="px-5 py-3 text-center">Locks</th>
                      <th className="px-5 py-3">Selected Teams & Odds</th>
                      <th className="px-5 py-3 text-center">Multiplier</th>
                      <th className="px-5 py-3 text-center">American Odds</th>
                      <th className="px-5 py-3 text-center">Implied Win %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {parlayPicks.map((row) => {
                      const parlay = parlayForPicks(row.picks, parlayGames);

                      return (
                        <tr key={row.userName} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap">
                            {row.userName}
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <span className="bg-white/10 text-white font-semibold text-xs px-2.5 py-1 rounded-full">
                              {row.picks.length}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {row.picks.map((p) => {
                                const ml = moneylineForPick(p.pickedTeam, findGameForPick(p, parlayGames));
                                const mlStr = ml !== null ? (ml > 0 ? `+${ml}` : `${ml}`) : '';
                                return (
                                  <span
                                    key={`${row.userName}-${p.pickedTeam}`}
                                    className="bg-black/30 border border-white/10 px-2 py-0.5 rounded text-xs text-white/90 flex items-center gap-1"
                                  >
                                    <TeamLogo team={p.pickedTeam} size="sm" className="scale-75" />
                                    <span>{p.pickedTeam}</span>
                                    {mlStr && <span className="text-yellow-300/90 text-[10px] font-bold">({mlStr})</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono text-white/80 whitespace-nowrap text-sm">
                            {parlay.multiplier}x
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <span className={`font-black text-sm px-2.5 py-0.5 rounded ${parlay.americanOdds.startsWith('+') ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                              }`}>
                              {parlay.americanOdds}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-white whitespace-nowrap">
                            {parlay.impliedProb}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: League Superlatives */}
        {(insights?.superlatives.length || 0) > 0 && (
          <div className="space-y-3 px-4 sm:px-0">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <span>🏅</span>
              <span>League Superlatives</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {insights?.superlatives.map((s) => (
                <div
                  key={s.title}
                  className="glass-card p-4 space-y-1.5 hover:border-yellow-400/40 transition-all duration-300"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{s.icon}</span>
                    <span className="text-[11px] uppercase font-black tracking-wider text-yellow-300">
                      {s.title}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-white font-bold text-lg truncate">{s.playerName}</span>
                    <span className="text-xs font-extrabold text-green-300 shrink-0">{s.stat}</span>
                  </div>
                  <p className="text-[11px] text-green-200/70 leading-snug">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Luck Ledger */}
        {(insights?.players || []).some(p => p.luck.gradedWeeks > 0) && (
          <div className="space-y-3 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>🍀</span>
                <span>Luck Ledger</span>
              </h2>
              <span className="text-xs text-green-200/70">
                What the closing line said your slates were worth, against what you actually scored
              </span>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-left text-xs font-bold text-green-200 uppercase tracking-wider">
                      <th className="px-5 py-3">Player</th>
                      <th className="px-5 py-3 text-center">Graded Wks</th>
                      <th className="px-5 py-3 text-center">Expected</th>
                      <th className="px-5 py-3 text-center">Actual</th>
                      <th className="px-5 py-3 text-center">Running</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {[...(insights?.players || [])]
                      .filter(p => p.luck.gradedWeeks > 0)
                      .sort((a, b) => b.luck.delta - a.luck.delta)
                      .map((player) => {
                        const hot = player.luck.delta > 0.5;
                        const cold = player.luck.delta < -0.5;
                        return (
                          <tr key={player.userId} className="hover:bg-white/5 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap">{player.name}</td>
                            <td className="px-5 py-3.5 text-center text-white/70">{player.luck.gradedWeeks}</td>
                            <td className="px-5 py-3.5 text-center font-semibold text-green-200">
                              {player.luck.expectedPoints.toFixed(2)}
                            </td>
                            <td className="px-5 py-3.5 text-center font-extrabold text-white">
                              {player.luck.actualPoints}
                            </td>
                            <td className="px-5 py-3.5 text-center whitespace-nowrap">
                              <span className={`font-black text-sm px-2.5 py-0.5 rounded ${
                                hot
                                  ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                                  : cold
                                    ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                                    : 'bg-white/10 text-white/70 border border-white/10'
                              }`}>
                                {player.luck.delta > 0 ? '+' : ''}{player.luck.delta.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-white/10 text-[11px] text-green-200/60 leading-snug">
                Expected points are the ticket length times the devigged chance every lock hits.
                Positive means you have scored more than the market said you should.
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Player Profiles & Tendencies Cards */}
        <div className="space-y-4 px-4 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>👤</span>
                <span>Player Profiles & Tendencies</span>
              </h2>
              <p className="text-xs text-green-200/70">
                Picks volume, individual hit rates, prime time preference, and home/road splits.
              </p>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allPlayers.map((player, rankIndex) => (
              <div
                key={player.userId}
                className="glass-card p-5 space-y-4 hover:border-yellow-400/40 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-700 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md border border-white/20">
                      {player.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-white font-bold text-lg">{player.name}</h3>
                        <span className="bg-yellow-400/20 text-yellow-300 text-xs px-2 py-0.5 rounded font-bold">
                          #{rankIndex + 1}
                        </span>
                      </div>
                      <span className="text-xs text-green-200/70">
                        {player.totalPoints} total points • {player.activeWeeks} active {player.activeWeeks === 1 ? 'week' : 'weeks'}
                      </span>
                    </div>
                  </div>

                  {player.topTeams?.[0] && (
                    <div className="flex flex-col items-center">
                      <TeamLogo team={player.topTeams[0].team} size="sm" />
                      <span className="text-[10px] text-white/60 mt-1 font-semibold">Fav Team</span>
                    </div>
                  )}
                </div>

                {/* 4-Stat Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[11px] text-white/60 font-medium">Picks Pace</div>
                    <div className="text-lg font-extrabold text-yellow-300">
                      {player.avgPicksPerWeek.toFixed(1)}
                      <span className="text-xs font-normal text-white/60 ml-1">/wk</span>
                    </div>
                    <div className="text-[10px] text-green-200/60">
                      {player.totalPicks} total locks chosen
                    </div>
                  </div>

                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[11px] text-white/60 font-medium">Lock Hit Rate</div>
                    <div className="text-lg font-extrabold text-white">
                      {player.completedPicks > 0 ? `${player.pickWinPct}%` : 'Pending'}
                    </div>
                    <div className="text-[10px] text-green-200/60">
                      {player.completedPicks > 0
                        ? `${player.correctPicks}/${player.completedPicks} games hit`
                        : `${player.totalPicks} games in play`}
                    </div>
                  </div>

                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[11px] text-white/60 font-medium">Prime Time Games</div>
                    <div className="text-lg font-extrabold text-indigo-300">
                      {player.primeTimePct}%
                    </div>
                    <div className="text-[10px] text-green-200/60">
                      {player.primeTimePicks} of {player.totalPicks} night locks
                    </div>
                  </div>

                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div className="text-[11px] text-white/60 font-medium">Perfect Weeks</div>
                    <div className="text-lg font-extrabold text-green-300">
                      {player.perfectWeeks}
                      <span className="text-xs font-normal text-white/60 ml-1">cashed</span>
                    </div>
                    <div className="text-[10px] text-green-200/60">
                      Best week: {player.maxWeekScore} pts
                    </div>
                  </div>
                </div>

                {/* Home vs Away Duel Bar */}
                <div className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="flex justify-between text-xs font-medium text-white/80">
                    <span className="flex items-center space-x-1">
                      <span>🏠 Home:</span>
                      <span className="text-blue-300 font-bold">{player.homePct}% ({player.homePicks})</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span>Away:</span>
                      <span className="text-orange-300 font-bold">{player.awayPct}% ({player.awayPicks})</span>
                      <span>✈️</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 h-full rounded-l-full transition-all duration-300"
                      style={{ width: `${player.homePct}%` }}
                    />
                    <div
                      className="bg-orange-500 h-full rounded-r-full transition-all duration-300"
                      style={{ width: `${player.awayPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-green-200/60 pt-0.5">
                    <span>Tendency: <strong className="text-white">{player.homeTendency}</strong></span>
                    <span>Max Ceiling: <strong className="text-yellow-300">{player.maxCeiling} pts</strong></span>
                  </div>
                </div>

                {/* Most Picked Teams */}
                {player.topTeams && player.topTeams.length > 0 && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-white/60">Most Locked:</span>
                    <div className="flex items-center space-x-3">
                      {player.topTeams.map((t, i) => (
                        <div key={i} className="flex items-center space-x-1">
                          <TeamLogo team={t.team} size="sm" className="scale-75" />
                          <span className="font-semibold text-white">{t.team}</span>
                          <span className="text-[10px] text-green-200/70">({t.count}x)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Team Ledger */}
        <div className="space-y-4 px-4 sm:px-0">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">💥</span>
              <div>
                <h2 className="text-2xl font-bold text-white">Team Ledger</h2>
                <p className="text-xs text-green-200/80">
                  Every team the league has locked, and whether backing them beat the price
                </p>
              </div>
            </div>

            {insights?.teamLedger && insights.teamLedger.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-left text-xs font-bold text-green-200 uppercase tracking-wider">
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3 text-center">Locked</th>
                      <th className="px-4 py-3 text-center">W–L</th>
                      <th className="px-4 py-3 text-center">Expected W</th>
                      <th className="px-4 py-3 text-center">Edge</th>
                      <th className="px-4 py-3">Burned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {insights.teamLedger.map((row) => (
                      <tr key={row.team} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamLogo team={row.team} size="sm" />
                            <span className="font-bold text-white truncate">{row.team}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-white/70">{row.locked}</td>
                        <td className="px-4 py-3 text-center font-semibold text-white">
                          {row.hits}–{row.misses}
                        </td>
                        <td className="px-4 py-3 text-center text-green-200/80">
                          {row.expectedHits.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`font-black text-xs px-2 py-0.5 rounded ${
                            row.edge > 0.25
                              ? 'bg-green-500/20 text-green-300 border border-green-400/30'
                              : row.edge < -0.25
                                ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                                : 'bg-white/10 text-white/70 border border-white/10'
                          }`}>
                            {row.edge > 0 ? '+' : ''}{row.edge.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-white/50 truncate max-w-[160px]">
                          {row.victims.length > 0 ? row.victims.join(', ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="pt-3 text-[11px] text-green-200/60 leading-snug">
                  Expected wins come from each team's closing line, so a heavy favourite holding serve
                  reads as par. Edge is wins above that — positive teams have paid off, negative ones
                  have cost the league more than their price said they should.
                </p>
              </div>
            ) : (
              <div className="bg-white/5 p-6 rounded-xl text-center text-sm text-green-200/80">
                🛡️ Nothing graded yet. Once games go final, every locked team shows up here with its record against the line.
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Overlap Matrix */}
        {insights?.overlap && insights.overlap.length > 0 && (
          <div className="space-y-3 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>🔗</span>
                <span>Who Copies Who</span>
              </h2>
              <span className="text-xs text-green-200/70">
                Hold the leader's exact ticket and you can never gain ground
              </span>
            </div>

            <div className="glass-card p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {insights.overlap.slice(0, 9).map((pair) => {
                  const tight = pair.similarity >= 60;
                  const loose = pair.similarity <= 20;
                  return (
                    <div
                      key={`${pair.a}-${pair.b}`}
                      className={`p-3.5 rounded-xl border ${
                        tight
                          ? 'bg-amber-500/10 border-amber-400/40'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white font-semibold text-sm truncate">
                          {pair.a} <span className="text-white/40">&</span> {pair.b}
                        </span>
                        <span className={`font-black text-base shrink-0 ${
                          tight ? 'text-amber-300' : loose ? 'text-white/50' : 'text-green-300'
                        }`}>
                          {pair.similarity}%
                        </span>
                      </div>
                      <div className="text-[11px] text-green-200/60 mt-0.5">
                        {pair.shared} identical {pair.shared === 1 ? 'lock' : 'locks'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Section 6: This Week's Sweet Spot */}
        {slateCurve.length > 0 && (
          <div className="space-y-4 px-4 sm:px-0">
            <div className="glass-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🧮</span>
                    <h2 className="text-xl font-bold text-white">Week {week} Sweet Spot</h2>
                  </div>
                  <p className="text-xs text-green-200/80 mt-1">
                    Built from this week's actual closing lines, taking the safest games first.
                    Each lock you add is the worst game left, which is what makes the curve turn over.
                  </p>
                </div>

                <div className="bg-white/10 px-3 py-2 rounded-xl border border-white/10 text-center shrink-0">
                  <div className="text-[10px] text-white/60 uppercase font-semibold">Best Play</div>
                  <div className="text-lg font-black text-yellow-400">{bestN} {bestN === 1 ? 'lock' : 'locks'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {slateCurve.map((tier) => {
                  const isOptimal = tier.n === bestN;
                  return (
                    <div
                      key={tier.n}
                      className={`p-3.5 rounded-xl border text-center transition-all duration-300 ${
                        isOptimal
                          ? 'bg-yellow-500/20 border-yellow-400/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {isOptimal && (
                        <span className="text-[9px] uppercase font-black tracking-wider bg-yellow-400 text-black px-2 py-0.5 rounded-full inline-block mb-1">
                          Sweet Spot
                        </span>
                      )}
                      <div className="text-xs font-bold text-white">{tier.n} {tier.n === 1 ? 'Lock' : 'Locks'}</div>
                      <div className="text-xl font-black text-yellow-300 my-0.5">
                        {tier.expected} <span className="text-[10px] font-medium text-white/60">exp pts</span>
                      </div>
                      <div className="text-[10px] text-green-200/70">
                        {tier.probability}% survives
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-black/20 rounded-xl border border-white/5 text-xs text-green-200/90 flex items-start space-x-2">
                <span>💡</span>
                <span>
                  On this board, <strong>{bestN} {bestN === 1 ? 'lock' : 'locks'}</strong> maximises expected points
                  at <strong>{slateCurve[bestN - 1]?.expected}</strong> per week.
                  {marginalProb !== null && (
                    <> Your next best game is only <strong>{(marginalProb * 100).toFixed(0)}%</strong>, and adding it drops
                    expectation to {slateCurve[bestN]?.expected}.</>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}


        {/* Section 7: Build a Ticket */}
        <div className="px-4 sm:px-0">
          <TicketBuilder
            games={parlayGames}
            week={week}
            myPicks={parlayPicks.find(row => row.userName === user.name)?.picks ?? []}
          />
        </div>

      </main>
    </div>
  );
}
