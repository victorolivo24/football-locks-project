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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-semibold text-gray-900">
                NFL Pick'em
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user.name}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Scoreboard</h1>
            <p className="text-gray-600">Season {season}</p>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-12 bg-gray-50">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
                      <th key={week} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        W{week}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scores.map((userScore, index) => (
                    <tr key={userScore.userId} className={index === 0 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-12 bg-white">
                        {userScore.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {userScore.totalScore}
                      </td>
                      {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => {
                        const weekScore = getWeeklyScore(userScore, week);
                        return (
                          <td key={week} className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              weekScore > 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
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

          <div className="mt-6 text-sm text-gray-600">
            <p><strong>Scoring:</strong> All picks correct = points equal to number of picks. Any wrong pick = 0 points.</p>
            <p><strong>Note:</strong> You must pick ALL games in a week to be eligible for points.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
