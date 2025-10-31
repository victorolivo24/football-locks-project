'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import OddsCard from './OddsCard';
import { useMotionLevel } from '@/components/motion/MotionProvider';

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
  const { intensity } = useMotionLevel();

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
  const currentWeekForOdds = Math.max(1, maxWeek || 1);

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
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 140, damping: 20 }}
        className="relative glass-card max-w-6xl mx-auto mt-4"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <motion.div className="flex items-center space-x-3" whileHover={{ rotateX: 1, rotateY: -1 }}>
              <Link href="/" className="flex items-center space-x-3">
                <div className="pulse-ring w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">🔒</span>
                </div>
                <span className="text-2xl font-bold text-slate-100">NFL Locks</span>
              </Link>
            </motion.div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-cyan-200 font-medium">Welcome, {user.name}</span>
            </div>
          </div>
        </div>
      </motion.nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-6 relative">
            <motion.div
              className="absolute inset-x-16 -top-16 h-48 rounded-full blur-3xl bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-cyan-400/25"
              animate={{ scale: [1, 1.06, 1], opacity: [0.35, 0.55, 0.35] }}
              transition={{ duration: 9 / intensity, repeat: Infinity }}
            />
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 170, damping: 20 }}
              className="text-4xl font-bold"
            >
              <span className="bg-gradient-to-r from-indigo-200 via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                Scoreboard
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-slate-300"
            >
              Season {season}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 150, damping: 24 }}
            className="glass-card overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-100 uppercase tracking-wider sticky left-0 bg-white/5 backdrop-blur-sm">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-100 uppercase tracking-wider sticky left-16 bg-white/5 backdrop-blur-sm">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-indigo-100 uppercase tracking-wider">
                      Total
                    </th>
                    {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
                      <th key={week} className="px-6 py-3 text-center text-xs font-medium text-indigo-100 uppercase tracking-wider">
                        W{week}
                      </th>
                    ))}
                  </tr>
                </thead>
                <motion.tbody
                  className="divide-y divide-white/10"
                  initial="hidden"
                  animate="visible"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
                >
                  {scores.map((userScore, index) => (
                    <motion.tr
                      key={userScore.userId}
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white sticky left-0 bg-transparent">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md ${index === 0 ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/10 text-slate-200'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-100 sticky left-16 bg-transparent">
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
                                ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/30'
                                : 'bg-white/5 text-slate-300 border border-white/10'
                            }`}>
                              {weekScore}
                            </span>
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </motion.div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              className="text-sm text-slate-300"
            >
              <p className="mb-1"><strong>Scoring:</strong> All locks correct = number of locks. Any wrong pick = 0.</p>
            </motion.div>
            <OddsCard season={season} week={currentWeekForOdds} />
          </div>

          
        </div>
      </main>
    </div>
  );
}
