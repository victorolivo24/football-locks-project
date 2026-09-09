'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OddsCard from './OddsCard';
import TeamLogo from '@/components/TeamLogo';
import { PlayerInsights, LeagueSuperlative, SeasonInsightsData, SlateBusterTeam } from '@/lib/insights';

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
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'insights' | 'slatebusters' | 'gametheory'>('scoreboard');
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
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Scoreboard & Insights</h1>
            <p className="text-green-200 text-sm">
              Season {season} • All-or-Nothing Scoring, Heartbreak Analytics & Game Theory
            </p>
          </div>

          {/* League Superlatives Highlight Bar */}
          {insights && insights.superlatives.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {insights.superlatives.map((sup, idx) => (
                <div
                  key={idx}
                  className="glass-section p-3 flex flex-col justify-between hover:border-yellow-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{sup.icon}</span>
                    <span className="text-[9px] uppercase font-bold tracking-wider text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                      {sup.title}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm truncate">{sup.playerName}</div>
                    <div className="text-green-300 font-extrabold text-xs">{sup.stat}</div>
                    <div className="text-[10px] text-green-200/60 truncate mt-0.5" title={sup.description}>
                      {sup.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex bg-black/40 p-1 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md flex-wrap justify-center gap-1">
              <button
                onClick={() => setActiveTab('scoreboard')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center space-x-1.5 ${
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
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center space-x-1.5 ${
                  activeTab === 'insights'
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🔍</span>
                <span>Player Insights</span>
              </button>
              <button
                onClick={() => setActiveTab('slatebusters')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center space-x-1.5 ${
                  activeTab === 'slatebusters'
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>💥</span>
                <span>Slate Busters</span>
              </button>
              <button
                onClick={() => setActiveTab('gametheory')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center space-x-1.5 ${
                  activeTab === 'gametheory'
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🏆</span>
                <span>Title Odds & Calculator</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Classic Leaderboard */}
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
                          Pace (Locks/Wk)
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-green-200 uppercase tracking-wider">
                          Lock Record
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-green-200 uppercase tracking-wider">
                          Home / Away
                        </th>
                        <th className="px-5 py-3.5 text-center text-xs font-semibold text-green-200 uppercase tracking-wider">
                          Night Games
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
                                <span className="bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                  {insight?.avgPicksPerWeek?.toFixed(1) ?? '3.0'} / wk
                                </span>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-center text-xs text-white/90">
                                {insight && insight.completedPicks > 0 ? (
                                  <span className="font-semibold">
                                    {insight.correctPicks}-{insight.completedPicks - insight.correctPicks}{' '}
                                    <span className="text-green-300 font-bold">({insight.pickWinPct}%)</span>
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

          {/* TAB 2: Player Insights Cards */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
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
                  <button
                    onClick={() => setPlayerFilter('heartbreak')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      playerFilter === 'heartbreak'
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    💔 1-Miss Heartbreaks
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPlayers.map((player, rankIndex) => (
                  <div
                    key={player.userId}
                    className="glass-card p-5 space-y-4 hover:border-yellow-400/40 transition-all duration-300 flex flex-col justify-between"
                  >
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
                            🛡️ No 1-miss heartbreaks yet. Clean record!
                          </span>
                        )}
                      </div>
                    </div>

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
                        <span>Max Potential: <strong className="text-yellow-300">{player.maxCeiling} pts</strong></span>
                      </div>
                    </div>

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
          )}

          {/* TAB 3: Slate Busters & Heartbreak Standings */}
          {activeTab === 'slatebusters' && (
            <div className="space-y-6">
              {/* Slate Busters Banner */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">💥</span>
                  <div>
                    <h2 className="text-2xl font-bold text-white">The "Slate Busters" (League Nemesis Teams)</h2>
                    <p className="text-xs text-green-200/80">
                      NFL teams that single-handedly ruined friends' perfect tickets by losing when locked
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

              {/* Heartbreak Index Table */}
              <div className="glass-card overflow-hidden">
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">💔</span>
                    <div>
                      <h3 className="text-xl font-bold text-white">The Heartbreak Index (One Pick Away)</h3>
                      <p className="text-xs text-green-200/80">
                        Tracks slates where a player was just <strong>1 game away</strong> from cashing a perfect payout
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-5 py-3 text-left text-xs font-bold text-green-200 uppercase tracking-wider">
                          Player
                        </th>
                        <th className="px-5 py-3 text-center text-xs font-bold text-red-300 uppercase tracking-wider">
                          1-Miss Weeks
                        </th>
                        <th className="px-5 py-3 text-center text-xs font-bold text-yellow-300 uppercase tracking-wider">
                          Points Left On Table
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-bold text-green-200 uppercase tracking-wider">
                          Toughest Beat
                        </th>
                        <th className="px-5 py-3 text-right text-xs font-bold text-green-200 uppercase tracking-wider">
                          Heartbreak Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {insights?.players.map((p) => {
                        const hb = p.heartbreak;
                        const hasHeartbreak = hb.heartbreakWeeks > 0;
                        return (
                          <tr key={p.userId} className="hover:bg-white/5 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-white">
                              {p.name}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-center text-sm font-extrabold text-red-300">
                              {hb.heartbreakWeeks}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-center text-sm font-extrabold text-yellow-300">
                              {hb.pointsLostToHeartbreak > 0 ? `-${hb.pointsLostToHeartbreak} pts` : '0 pts'}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-xs text-white/90">
                              {hb.worstHeartbreak ? (
                                <span>
                                  Week {hb.worstHeartbreak.week}: Went {hb.worstHeartbreak.record} (Spoiled by {hb.worstHeartbreak.spoilerTeam})
                                </span>
                              ) : (
                                <span className="text-white/40">Clean slate so far</span>
                              )}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-right">
                              {hasHeartbreak ? (
                                <span className="bg-red-900/30 text-red-200 border border-red-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                  💔 Robbed
                                </span>
                              ) : (
                                <span className="bg-green-900/20 text-green-300 border border-green-500/20 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                                  ✅ Unscathed
                                </span>
                              )}
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

          {/* TAB 4: Optimal Picks & Title Odds */}
          {activeTab === 'gametheory' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <OddsCard season={season} week={currentWeekForOdds} />

              {/* Interactive Sweet Spot Simulator */}
              <div className="glass-card p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">🧮</span>
                      <h2 className="text-xl font-bold text-white">Optimal Pick Calculator</h2>
                    </div>
                    <p className="text-xs text-green-200/80 mt-1">
                      See how your win rate affects the best number of locks to pick each week.
                    </p>
                  </div>

                  <div className="bg-white/10 p-2.5 rounded-xl border border-white/10 flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-white/60 uppercase font-semibold">Your Win Rate</div>
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

                {/* EV Curve Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {evCurve.map((tier) => {
                    const isOptimal = tier.n === bestCalculatorN.n;
                    return (
                      <div
                        key={tier.n}
                        className={`p-3 rounded-xl border text-center transition-all duration-300 ${
                          isOptimal
                            ? 'bg-yellow-500/20 border-yellow-400/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {isOptimal && (
                          <span className="text-[9px] uppercase font-black tracking-wider bg-yellow-400 text-black px-1.5 py-0.5 rounded-full inline-block mb-1">
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
                    At a <strong>{calculatorHitRate}%</strong> win rate, picking <strong>{bestCalculatorN.n} locks/week</strong> gives you the highest average points over the season ({bestCalculatorN.ev} pts/wk).
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
