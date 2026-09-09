'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';
import { PlayerInsights, SeasonInsightsData } from '@/lib/insights';

interface User {
  name: string;
  userId: number;
}

export default function NerdStatsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [insights, setInsights] = useState<SeasonInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<number>(2026);
  const [playerFilter, setPlayerFilter] = useState<'all' | 'high-volume' | 'home-biased' | 'primetime' | 'heartbreak'>('all');
  const [calculatorHitRate, setCalculatorHitRate] = useState<number>(70);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    checkAuth();
    const seasonParam = searchParams.get('season');
    if (seasonParam) {
      setSeason(parseInt(seasonParam));
    } else {
      fetch('/api/week')
        .then(res => res.json())
        .then(data => {
          if (data.season) setSeason(data.season);
        })
        .catch(() => undefined);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user, season]);

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
      const response = await fetch(`/api/insights?season=${season}`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
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

  const filteredPlayers = (insights?.players || []).filter(p => {
    if (playerFilter === 'high-volume') return p.avgPicksPerWeek >= 4;
    if (playerFilter === 'home-biased') return p.homePct >= 60;
    if (playerFilter === 'primetime') return p.primeTimePct >= 35;
    if (playerFilter === 'heartbreak') return p.heartbreak.heartbreakWeeks > 0;
    return true;
  });

  // Calculate EV curve for interactive calculator
  const p = calculatorHitRate / 100;
  const evCurve = [1, 2, 3, 4, 5, 6].map(n => {
    const ev = n * Math.pow(p, n);
    return { n, ev: Number(ev.toFixed(2)), prob: Number((Math.pow(p, n) * 100).toFixed(1)) };
  });
  const bestCalculatorN = evCurve.reduce((max, curr) => curr.ev > max.ev ? curr : max, evCurve[0]);

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
              Season {season} • Deep dive into player tendencies, home/road splits, heartbreak slates, and sweet spot math.
            </p>
          </div>
          <Link
            href={`/scoreboard?season=${season}`}
            className="text-xs sm:text-sm font-bold text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 px-4 py-2 rounded-xl transition-colors self-start sm:self-auto"
          >
            📊 View Scoreboard
          </Link>
        </div>

        {/* Section 1: League Superlatives */}
        {insights && insights.superlatives.length > 0 && (
          <div className="space-y-3 px-4 sm:px-0">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>🏅</span>
              <span>League Superlatives</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {insights.superlatives.map((sup, idx) => (
                <div
                  key={idx}
                  className="glass-card p-4 flex flex-col justify-between hover:border-yellow-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{sup.icon}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                      {sup.title}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-bold text-base truncate">{sup.playerName}</div>
                    <div className="text-green-300 font-extrabold text-sm">{sup.stat}</div>
                    <div className="text-[11px] text-green-200/70 truncate mt-1" title={sup.description}>
                      {sup.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 2: Player Insights & Tendencies Cards */}
        <div className="space-y-4 px-4 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>👤</span>
                <span>Player Profiles & Tendencies</span>
              </h2>
              <p className="text-xs text-green-200/70">
                Picks volume, individual hit rates, prime time preference, and heartbreak records.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setPlayerFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  playerFilter === 'all'
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                }`}
              >
                All ({insights?.players.length || 0})
              </button>
              <button
                onClick={() => setPlayerFilter('high-volume')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  playerFilter === 'high-volume'
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                }`}
              >
                🎰 High Volume
              </button>
              <button
                onClick={() => setPlayerFilter('home-biased')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  playerFilter === 'home-biased'
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                }`}
              >
                🏠 Home Bias
              </button>
              <button
                onClick={() => setPlayerFilter('primetime')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  playerFilter === 'primetime'
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                }`}
              >
                🌙 Night Games
              </button>
              <button
                onClick={() => setPlayerFilter('heartbreak')}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  playerFilter === 'heartbreak'
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                }`}
              >
                💔 Heartbreaks
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPlayers.map((player, rankIndex) => (
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

                {/* Heartbreak Box on Player Card */}
                <div className={`p-3 rounded-xl border ${
                  player.heartbreak.heartbreakWeeks > 0
                    ? 'bg-red-950/20 border-red-500/30 text-red-200'
                    : 'bg-white/5 border-white/10 text-white/80'
                }`}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center space-x-1 font-bold">
                      <span>💔 Heartbreak Index:</span>
                      <span className={player.heartbreak.heartbreakWeeks > 0 ? 'text-red-300 font-extrabold' : 'text-green-300'}>
                        {player.heartbreak.heartbreakWeeks} {player.heartbreak.heartbreakWeeks === 1 ? 'week' : 'weeks'}
                      </span>
                    </span>
                    {player.heartbreak.pointsLostToHeartbreak > 0 && (
                      <span className="text-[11px] font-extrabold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                        -{player.heartbreak.pointsLostToHeartbreak} pts lost
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] leading-snug">
                    {player.heartbreak.worstHeartbreak ? (
                      <span className="text-red-200/90">
                        Toughest beat: Week {player.heartbreak.worstHeartbreak.week} (went {player.heartbreak.worstHeartbreak.record}, spoiled by {player.heartbreak.worstHeartbreak.spoilerTeam})
                      </span>
                    ) : (
                      <span className="text-green-300/80">
                        🛡️ Clean record. No 1-miss heartbreaks!
                      </span>
                    )}
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

        {/* Section 3: The Slate Busters */}
        <div className="space-y-4 px-4 sm:px-0">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">💥</span>
              <div>
                <h2 className="text-2xl font-bold text-white">The "Slate Busters" (League Nemesis Teams)</h2>
                <p className="text-xs text-green-200/80">
                  NFL teams that single-handedly betrayed friends by losing when locked
                </p>
              </div>
            </div>

            {insights?.slateBusters && insights.slateBusters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {insights.slateBusters.map((buster, i) => (
                  <div
                    key={buster.team}
                    className="glass-section p-4 flex items-center space-x-4 border-red-500/20 bg-red-950/10"
                  >
                    <div className="relative">
                      <TeamLogo team={buster.team} size="md" />
                      <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                        #{i + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-base truncate">{buster.team}</div>
                      <div className="text-red-300 font-extrabold text-xs">
                        {buster.lossesCaused} ticket{buster.lossesCaused === 1 ? '' : 's'} busted
                      </div>
                      <div className="text-[10px] text-white/60 truncate mt-0.5">
                        Victims: {buster.victims.join(', ')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-yellow-400">
                        ~{buster.pointsRuined} pts
                      </span>
                      <div className="text-[9px] text-white/40">ruined</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/5 p-6 rounded-xl text-center text-sm text-green-200/80">
                🛡️ No tickets have been busted by final games yet! As games finish, the league's most notorious spoiler teams will appear here.
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Sweet Spot Pick Calculator Widget */}
        <div className="space-y-4 px-4 sm:px-0">
          <div className="glass-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🧮</span>
                  <h2 className="text-xl font-bold text-white">Optimal Pick Count Calculator</h2>
                </div>
                <p className="text-xs text-green-200/80 mt-1">
                  In all-or-nothing scoring, choosing more locks gives bigger payouts, but reduces week-to-week cash probability. See where your sweet spot lies:
                </p>
              </div>

              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10 flex items-center space-x-3 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] text-white/60 uppercase font-semibold">Simulate Win Rate</div>
                  <div className="text-lg font-black text-yellow-400">{calculatorHitRate}%</div>
                </div>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="1"
                  value={calculatorHitRate}
                  onChange={(e) => setCalculatorHitRate(Number(e.target.value))}
                  className="w-24 accent-yellow-400 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {evCurve.map((tier) => {
                const isOptimal = tier.n === bestCalculatorN.n;
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
                    <div className="text-xs font-bold text-white">{tier.n} Locks / Wk</div>
                    <div className="text-xl font-black text-yellow-300 my-0.5">
                      {tier.ev} <span className="text-[10px] font-medium text-white/60">avg pts</span>
                    </div>
                    <div className="text-[10px] text-green-200/70">
                      {tier.prob}% hit chance
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-black/20 rounded-xl border border-white/5 text-xs text-green-200/90 flex items-center space-x-2">
              <span>💡</span>
              <span>
                At a <strong>{calculatorHitRate}%</strong> win rate, picking <strong>{bestCalculatorN.n} locks/week</strong> produces the highest average points over the course of the season ({bestCalculatorN.ev} pts/wk).
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
