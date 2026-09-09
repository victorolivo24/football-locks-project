'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OddsCard from './OddsCard';

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
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<number>(2026);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white animate-pulse">Loading Scoreboard...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
            <div className="flex items-center space-x-3">
              <Link
                href={`/stats?season=${season}`}
                className="text-xs sm:text-sm font-bold text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5"
              >
                <span>🤓</span>
                <span>Nerd Stats</span>
              </Link>
              <Link
                href="/"
                className="text-sm text-green-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Dashboard
              </Link>
              <span className="text-sm text-green-200 font-medium hidden sm:inline">Welcome, {user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight">Scoreboard</h1>
              <p className="text-green-200 text-sm mt-0.5">
                Season {season} • All-or-Nothing Weekly Locks
              </p>
            </div>
            <Link
              href={`/stats?season=${season}`}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold text-sm px-4 py-2 rounded-xl shadow-lg hover:from-yellow-400 hover:to-amber-300 transition-all transform hover:scale-[1.02]"
            >
              <span>🤓</span>
              <span>View Nerd Stats & Insights →</span>
            </Link>
          </div>

          {/* Clean Leaderboard Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-green-200 uppercase tracking-wider sticky left-0 bg-black/30 backdrop-blur-sm z-10">
                      Rank
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-green-200 uppercase tracking-wider sticky left-16 bg-black/30 backdrop-blur-sm z-10">
                      Player
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-bold text-green-200 uppercase tracking-wider">
                      Total Score
                    </th>
                    {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
                      <th key={week} className="px-5 py-3.5 text-center text-xs font-medium text-green-200 uppercase tracking-wider">
                        W{week}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {scores.length === 0 ? (
                    <tr>
                      <td colSpan={maxWeek + 3} className="px-6 py-12 text-center text-green-200">
                        No players have submitted picks yet for Season {season}.
                      </td>
                    </tr>
                  ) : (
                    scores.map((userScore, index) => (
                      <tr key={userScore.userId} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white sticky left-0 bg-transparent">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md ${
                            index === 0 ? 'bg-yellow-400 text-black font-extrabold shadow-sm' : 'bg-white/10 text-white'
                          }`}>
                            #{index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base font-semibold text-white sticky left-16 bg-transparent">
                          {userScore.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-lg font-extrabold text-white">
                          {userScore.totalScore}
                        </td>
                        {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => {
                          const weekScore = getWeeklyScore(userScore, week);
                          return (
                            <td key={week} className="px-5 py-4 whitespace-nowrap text-sm text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Grid: Rules & Title Odds */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-card p-6 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-bold text-lg flex items-center space-x-2">
                  <span>📋</span>
                  <span>Scoring Rules</span>
                </h3>
                <div className="space-y-2.5 text-sm text-green-200/90 leading-relaxed mt-3">
                  <p>
                    <strong>All-or-Nothing:</strong> If you get <em>every single lock</em> right in a week, you get points equal to your number of locks!
                  </p>
                  <p>
                    <strong>Miss One, Miss All:</strong> Any wrong pick gives you 0 points for that week. Choosing more locks unlocks more upside, but requires a flawless slate.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/60">Curious about pick volumes & heartbreak moments?</span>
                <Link
                  href={`/stats?season=${season}`}
                  className="text-xs font-bold text-yellow-300 hover:text-yellow-200 underline"
                >
                  Explore Nerd Stats →
                </Link>
              </div>
            </div>

            <OddsCard season={season} week={currentWeekForOdds} />
          </div>
        </div>
      </main>
    </div>
  );
}
