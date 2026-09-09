'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OddsCard from './OddsCard';
import TeamLogo from '@/components/TeamLogo';
import { PlayerInsights, LeagueSuperlative, SeasonInsightsData } from '@/lib/insights';

interface WeeklyScore {
  week: number;
  points: number;
}

interface UserScore {
  userId: number;
  name: string;
  totalScore: number;
  weeklyScores: WeeklyScore[];
}

interface User {
  name: string;
  userId: number;
}

export default function ScoreboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [scores, setScores] = useState<UserScore[]>([]);
  const [insights, setInsights] = useState<SeasonInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<number>(2026);
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'insights' | 'odds'>('scoreboard');
  const [playerFilter, setPlayerFilter] = useState<'all' | 'high-volume' | 'home-biased' | 'primetime'>('all');
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
      fetchScores();
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

  const fetchScores = async () => {
    try {
      const response = await fetch(`/api/scoreboard?season=${season}`);
      if (response.ok) {
        const data = await response.json();
        setScores(data.scores || []);
      }
    } catch (error) {
      console.error('Error fetching scores:', error);
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

  const getWeeklyScore = (userScore: UserScore, week: number) => {
    const weeklyScore = userScore.weeklyScores.find(ws => ws.week === week);
    return weeklyScore?.points || 0;
  };

  const getMaxWeek = () => {
    if (scores.length === 0) return 0;
    const allWeeks = scores.flatMap(score => score.weeklyScores.map(ws => ws.week));
    return Math.max(...allWeeks, 0);
  };

  const maxWeek = getMaxWeek();
  const currentWeekForOdds = Math.max(1, maxWeek || 1);

  // Match player insights with scores
  const getPlayerInsight = (userId: number): PlayerInsights | undefined => {
    return insights?.players.find(p => p.userId === userId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white animate-pulse">Loading Scoreboard & Insights...</div>
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
    return true;
  });

  return (
    <div className="min-h-screen pb-12">
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
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-sm text-green-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Dashboard
              </Link>
              <span className="text-sm text-green-200 font-medium">Welcome, {user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0 space-y-6">
          {/* Header Banner */}
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Scoreboard & Insights</h1>
            <p className="text-green-200 text-sm">
              Season {season} • All-or-Nothing Scoring & Deep Lock Analytics
            </p>
          </div>

          {/* League Superlatives Highlight Bar */}
          {insights && insights.superlatives.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {insights.superlatives.map((sup, idx) => (
                <div
                  key={idx}
                  className="glass-section p-3.5 flex flex-col justify-between hover:border-yellow-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xl">{sup.icon}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                      {sup.title}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-bold text-base truncate">{sup.playerName}</div>
                    <div className="text-green-300 font-extrabold text-xs">{sup.stat}</div>
                    <div className="text-[10px] text-green-200/60 truncate mt-0.5" title={sup.description}>
                      {sup.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Navigation View Switcher */}
          <div className="flex justify-center">
            <div className="inline-flex bg-black/40 p-1 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md">
              <button
                onClick={() => setActiveTab('scoreboard')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === 'scoreboard'
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>📊</span>
                <span>Leaderboard</span>
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === 'insights'
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🔍</span>
                <span>Player Insights</span>
              </button>
              <button
                onClick={() => setActiveTab('odds')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === 'odds'
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🏆</span>
                <span>Championship Odds</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Leaderboard Table */}
          {activeTab === 'scoreboard' && (
            <div className="space-y-6">
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-green-200 uppercase tracking-wider sticky left-0 bg-black/30 backdrop-blur-sm z-10">
                          Rank
                        </th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-green-200 uppercase tracking-wider sticky left-16 bg-black/30 backdrop-blur-sm z-10">
                          Player
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-bold text-green-200 uppercase tracking-wider">
                          Total Pts
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-yellow-300 uppercase tracking-wider">
                          Avg Locks/Wk
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-green-200 uppercase tracking-wider">
                          Lock Record
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-green-200 uppercase tracking-wider">
                          Home / Road
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-green-200 uppercase tracking-wider">
                          Prime Time
                        </th>
                        {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
                          <th key={week} className="px-4 py-3.5 text-center text-xs font-medium text-green-200 uppercase tracking-wider">
                            W{week}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {scores.length === 0 ? (
                        <tr>
                          <td colSpan={maxWeek + 7} className="px-6 py-12 text-center text-green-200">
                            No players have submitted picks yet for Season {season}.
                          </td>
                        </tr>
                      ) : (
                        scores.map((userScore, index) => {
                          const insight = getPlayerInsight(userScore.userId);
                          return (
                            <tr key={userScore.userId} className="hover:bg-white/5 transition-colors">
                              <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-white sticky left-0 bg-transparent">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md ${
                                  index === 0 ? 'bg-yellow-400 text-black font-extrabold shadow-sm' : 'bg-white/10 text-white'
                                }`}>
                                  #{index + 1}
                                </span>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-white sticky left-16 bg-transparent">
                                <div className="flex items-center space-x-2">
                                  <span>{userScore.name}</span>
                                  {insight?.topTeams?.[0] && (
                                    <span title={`Most Picked: ${insight.topTeams[0].team} (${insight.topTeams[0].count})`}>
                                      <TeamLogo team={insight.topTeams[0].team} size="sm" className="scale-75 inline-block" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center text-base font-extrabold text-white">
                                {userScore.totalScore}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center">
                                <span className="bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full text-xs font-bold">
                                  {insight?.avgPicksPerWeek?.toFixed(1) ?? '3.0'} / wk
                                </span>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center text-xs text-white/90">
                                {insight && insight.completedPicks > 0 ? (
                                  <span className="font-semibold">
                                    {insight.correctPicks}-{insight.completedPicks - insight.correctPicks}{' '}
                                    <span className="text-green-300">({insight.pickWinPct}%)</span>
                                  </span>
                                ) : (
                                  <span className="text-white/40">{insight?.totalPicks ?? 0} active</span>
                                )}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center text-xs">
                                {insight && insight.totalPicks > 0 ? (
                                  <span className="text-white/80">
                                    <span className="text-blue-300 font-semibold">{insight.homePct}% H</span> /{' '}
                                    <span className="text-orange-300 font-semibold">{insight.awayPct}% A</span>
                                  </span>
                                ) : (
                                  <span className="text-white/40">-</span>
                                )}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center text-xs text-white/90">
                                {insight && insight.totalPicks > 0 ? (
                                  <span className="bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-md text-indigo-200">
                                    🌙 {insight.primeTimePicks} ({insight.primeTimePct}%)
                                  </span>
                                ) : (
                                  <span className="text-white/40">-</span>
                                )}
                              </td>
                              {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => {
                                const weekScore = getWeeklyScore(userScore, week);
                                return (
                                  <td key={week} className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      weekScore > 0
                                        ? 'bg-green-600/25 text-green-200 border border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.3)]'
                                        : 'bg-white/5 text-white/60 border border-white/10'
                                    }`}>
                                      {weekScore}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="glass-card p-5 space-y-3">
                  <h3 className="text-white font-bold text-lg flex items-center space-x-2">
                    <span>📋</span>
                    <span>Scoring & Lock Rules</span>
                  </h3>
                  <div className="space-y-2 text-sm text-green-200/90 leading-relaxed">
                    <p>
                      <strong>All-or-Nothing Scoring:</strong> If you get <em>every single lock</em> correct in a week, you earn points equal to your number of locks!
                    </p>
                    <p>
                      <strong>High Risk, High Reward:</strong> If any single pick loses, you get 0 points for that week. Choosing more locks unlocks more upside, but requires a flawless slate.
                    </p>
                    <p className="text-xs text-white/60 pt-1 border-t border-white/10">
                      Lock deadline is Thursday evening (Wednesday on Week 1). Games cannot be edited once kickoff begins.
                    </p>
                  </div>
                </div>

                <OddsCard season={season} week={currentWeekForOdds} />
              </div>
            </div>
          )}

          {/* Tab 2: Deep Dive Player Insights */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* Filter pills */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPlayerFilter('all')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      playerFilter === 'all'
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    All Players ({insights?.players.length || 0})
                  </button>
                  <button
                    onClick={() => setPlayerFilter('high-volume')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      playerFilter === 'high-volume'
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    🎰 High Volume (4+ locks/wk)
                  </button>
                  <button
                    onClick={() => setPlayerFilter('home-biased')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      playerFilter === 'home-biased'
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    🏠 Homefield Believers (&gt;60% Home)
                  </button>
                  <button
                    onClick={() => setPlayerFilter('primetime')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      playerFilter === 'primetime'
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    🌙 Night Game Lovers
                  </button>
                </div>
                <span className="text-xs text-green-200/70">
                  Showing {filteredPlayers.length} of {insights?.players.length || 0} players
                </span>
              </div>

              {/* Player Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPlayers.map((player, rankIndex) => {
                  return (
                    <div
                      key={player.userId}
                      className="glass-card p-5 space-y-4 hover:border-yellow-400/40 transition-all duration-300 flex flex-col justify-between"
                    >
                      {/* Card Header */}
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

                      {/* Stat Tiles Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                          <div className="text-[11px] text-white/60 font-medium">Picks / Week</div>
                          <div className="text-lg font-extrabold text-yellow-300">
                            {player.avgPicksPerWeek.toFixed(1)}
                            <span className="text-xs font-normal text-white/60 ml-1">avg</span>
                          </div>
                          <div className="text-[10px] text-green-200/60">
                            {player.totalPicks} total locks chosen
                          </div>
                        </div>

                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                          <div className="text-[11px] text-white/60 font-medium">Lock Hit Rate</div>
                          <div className="text-lg font-extrabold text-white">
                            {player.completedPicks > 0 ? `${player.pickWinPct}%` : 'N/A'}
                          </div>
                          <div className="text-[10px] text-green-200/60">
                            {player.completedPicks > 0
                              ? `${player.correctPicks}/${player.completedPicks} games hit`
                              : `${player.totalPicks} pending games`}
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

                      {/* Home vs Road Tendency Bar */}
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
                            title={`Home Picks: ${player.homePct}%`}
                          />
                          <div
                            className="bg-orange-500 h-full rounded-r-full transition-all duration-300"
                            style={{ width: `${player.awayPct}%` }}
                            title={`Away Picks: ${player.awayPct}%`}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-green-200/60 pt-0.5">
                          <span>Tendency: <strong className="text-white">{player.homeTendency}</strong></span>
                          <span>Max Potential: <strong className="text-yellow-300">{player.maxCeiling} pts</strong></span>
                        </div>
                      </div>

                      {/* Favorite Teams Locked */}
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Championship Odds & Projections */}
          {activeTab === 'odds' && (
            <div className="grid gap-6 md:grid-cols-2">
              <OddsCard season={season} week={currentWeekForOdds} />

              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">📈</span>
                  <h3 className="text-white font-bold text-xl">Pace & Projections Engine</h3>
                </div>
                <p className="text-sm text-green-200/90 leading-relaxed">
                  Unlike traditional pick'ems with flat predictions, our model uses each player's <strong>actual picking volume</strong> (e.g. David’s 6 picks/wk vs Dakota’s 1 pick/wk) and historical slate hit rate.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                    <div className="text-sm font-bold text-yellow-300">High Volume Upside</div>
                    <p className="text-xs text-white/80">
                      Picking 5–6 games creates explosive point opportunities on perfect weeks (up to 6 points in a single week), but significantly lowers week-to-week cash probability.
                    </p>
                  </div>

                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                    <div className="text-sm font-bold text-blue-300">Conservative Sniper Strategy</div>
                    <p className="text-xs text-white/80">
                      Picking 1–2 locks increases the mathematical chance of a clean sheet, providing a steady floor with limited ceiling.
                    </p>
                  </div>

                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                    <div className="text-sm font-bold text-green-300">Comeback Math</div>
                    <p className="text-xs text-white/80">
                      With {Math.max(0, 18 - currentWeekForOdds)} weeks remaining, a 6-pick player has a theoretical ceiling of +{(Math.max(0, 18 - currentWeekForOdds) * 6)} points, keeping title dreams alive late into December.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
