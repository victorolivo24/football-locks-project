'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
  const [season, setSeason] = useState<number>(2024);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    checkAuth();
    const seasonParam = searchParams.get('season');
    if (seasonParam) {
      setSeason(parseInt(seasonParam));
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
        setScores(data.scores);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <nav className="relative glass-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-lg">🏈</span>
                </div>
                <span className="text-2xl font-bold text-white">NFL Pick'em</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-green-200 font-medium">Welcome, {user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-white">Scoreboard</h1>
            <p className="text-green-200">Season {season}</p>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-3 text-left text-xs font-bold text-green-200 uppercase tracking-wider sticky left-0 bg-white/5 backdrop-blur-sm">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-green-200 uppercase tracking-wider sticky left-16 bg-white/5 backdrop-blur-sm">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-green-200 uppercase tracking-wider">
                      Total
                    </th>
                    {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
                      <th key={week} className="px-6 py-3 text-center text-xs font-medium text-green-200 uppercase tracking-wider">
                        W{week}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {scores.map((userScore, index) => (
                    <tr key={userScore.userId} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white sticky left-0 bg-transparent">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white sticky left-16 bg-transparent">
                        {userScore.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                        {userScore.totalScore}
                      </td>
                      {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => {
                        const weekScore = getWeeklyScore(userScore, week);
                        return (
                          <td key={week} className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              weekScore > 0
                                ? 'bg-green-600/20 text-green-200 border border-green-500/30'
                                : 'bg-white/10 text-white/80 border border-white/10'
                            }`}>
                              {weekScore}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 text-sm text-green-200/90">
            <p className="mb-1"><strong>Scoring:</strong> All picks correct = number of picks. Any wrong pick = 0.</p>
            <p><strong>Note:</strong> You must pick ALL games in a week to be eligible for points.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
