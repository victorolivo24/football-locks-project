'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { getLockTime, isPicksLocked } from '@/lib/nfl';
import { motion } from 'framer-motion';
import { useMotionLevel } from '@/components/motion/MotionProvider';

interface User {
  name: string;
  userId: number;
}

interface WeekInfo {
  season: number;
  week: number;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
  const [timeUntilLock, setTimeUntilLock] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchWeekInfo();
  }, []);

  useEffect(() => {
    if (weekInfo) {
      const timer = setInterval(() => {
        updateTimeUntilLock();
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [weekInfo]);

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

  const fetchWeekInfo = async () => {
    try {
      const response = await fetch('/api/week');
      if (response.ok) {
        const data = await response.json();
        setWeekInfo(data);
      }
    } catch (error) {
      console.error('Error fetching week info:', error);
    }
  };

  const updateTimeUntilLock = () => {
    if (!weekInfo) return;

    const lockTime = getLockTime(weekInfo.season, weekInfo.week);
    const now = DateTime.now().setZone('America/New_York');
    const diff = lockTime.diff(now);

    if (diff.milliseconds <= 0) {
      setTimeUntilLock('LOCKED');
    } else {
      const days = Math.floor(diff.as('days'));
      const hours = Math.floor(diff.as('hours') % 24);
      const minutes = Math.floor(diff.as('minutes') % 60);
      const seconds = Math.floor(diff.as('seconds') % 60);

      if (days > 0) {
        setTimeUntilLock(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeUntilLock(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeUntilLock(`${minutes}m ${seconds}s`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const { intensity } = useMotionLevel();
  const heroPulse = {
    animate: {
      scale: [1, 1.05 + 0.05 * intensity, 1],
      opacity: [0.35, 0.55 * intensity, 0.35],
    },
    transition: {
      duration: 6 / intensity,
      repeat: Infinity,
      repeatType: 'mirror',
      ease: 'easeInOut',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user || !weekInfo) {
    return null;
  }

  const isLocked = isPicksLocked(weekInfo.season, weekInfo.week);

  return (
    <div className="min-h-screen">
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="relative glass-card border border-white/10 backdrop-blur-2xl mx-auto mt-4 max-w-6xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <motion.div
              className="flex items-center space-x-3"
              whileHover={{ x: -2, rotate: -2 }}
            >
              <div className="pulse-ring w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">🔒</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">NFL Locks</h1>
            </motion.div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-cyan-200 font-medium">Welcome, {user.name}</span>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 10px 35px rgba(24,216,255,0.35)' }}
                whileTap={{ scale: 0.96 }}
                onClick={handleLogout}
                className="relative overflow-hidden rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-sm text-slate-200 transition-all"
              >
                <span className="relative z-[2]">Logout</span>
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 via-cyan-400/20 to-transparent opacity-0"
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      <main className="relative max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Hero Section */}
          <div className="text-center mb-8 relative">
            <motion.div
              {...heroPulse}
              className="absolute inset-x-10 -top-16 h-64 rounded-full bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-cyan-400/25 blur-3xl"
            />
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', delay: 0.05 }}
              className="text-4xl md:text-6xl font-bold mb-4 neon-text"
            >
              <span className="bg-gradient-to-r from-indigo-200 via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                NFL Locks
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-xl text-slate-300 mb-6"
            >
              Season {weekInfo.season} • Week {weekInfo.week}
            </motion.p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
            {/* Current Week Info */}
            {[
              {
                title: 'Current Week',
                emoji: '📅',
                gradient: 'from-indigo-600/30 via-purple-600/25 to-sky-500/10',
                border: 'border-indigo-400/20',
                body: (
                  <>
                    <p className="text-4xl font-bold text-white mb-2">Week {weekInfo.week}</p>
                    <p className="text-indigo-100">Season {weekInfo.season}</p>
                  </>
                ),
              },
              {
                title: 'Picks Lock In',
                emoji: '⏰',
                gradient: 'from-rose-600/30 via-pink-600/20 to-amber-500/10',
                border: 'border-rose-400/25',
                body: (
                  <>
                    <p className="text-3xl font-bold text-white mb-2">{timeUntilLock}</p>
                    <p className="text-rose-100">Thursday 8:00 PM ET</p>
                  </>
                ),
              },
              {
                title: 'Status',
                emoji: isLocked ? '🔒' : '✅',
                gradient: isLocked
                  ? 'from-slate-600/40 via-slate-800/40 to-slate-900/60'
                  : 'from-emerald-500/25 via-teal-500/20 to-indigo-500/15',
                border: isLocked ? 'border-slate-500/30' : 'border-emerald-400/25',
                body: (
                  <>
                    <p className="text-3xl font-bold text-white mb-2">{isLocked ? 'LOCKED' : 'OPEN'}</p>
                    <p className="text-slate-300">
                      {isLocked ? 'Picks are locked' : 'Picks are open'}
                    </p>
                  </>
                ),
              },
            ].map((card, idx) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * idx, type: 'spring', stiffness: 140, damping: 20 }}
                whileHover={{ y: -6, rotateX: 2, rotateY: -2 }}
                className={`rounded-2xl p-6 shadow-2xl border ${card.border} bg-gradient-to-br ${card.gradient}`}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-white/10 border border-white/10 rounded-full flex items-center justify-center">
                    <span className="text-2xl">{card.emoji}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">{card.title}</h3>
                </div>
                {card.body}
              </motion.div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/week/${weekInfo.season}/${weekInfo.week}`}
              className="group relative btn-yellow px-8 py-4 text-lg tracking-wide overflow-hidden rounded-2xl"
            >
              <span className="mr-2 text-2xl">🔒</span>
              {isLocked ? 'View Picks' : 'Make Picks'}
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl"></div>
            </Link>
            
            <Link
              href={`/scoreboard?season=${weekInfo.season}`}
              className="group relative btn-blue px-8 py-4 text-lg tracking-wide overflow-hidden rounded-2xl"
            >
              <span className="mr-2 text-2xl">🏆</span>
              View Scoreboard
              <div className="absolute inset-0 bg-cyan-200/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl"></div>
            </Link>

            <Link
              href={`/picks/${weekInfo.season}/${weekInfo.week}`}
              className="group relative btn-slate px-8 py-4 text-lg tracking-wide overflow-hidden rounded-2xl"
            >
              <span className="mr-2 text-2xl">👥</span>
              All Picks
              <div className="absolute inset-0 bg-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl"></div>
            </Link>

            {/* Admin link removed for deployment */}
          </div>

          <motion.div
            className="mt-12 flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
          >
            <div className="holo-border px-8 py-4">
              <div className="flex items-center gap-3 text-slate-200 text-sm">
                <span className="text-cyan-200">💡</span>
                <p>
                  Tip: crank motion to <span className="text-emerald-300 font-semibold">Hyper</span> to reveal deeper
                  parallax, glowing trails, and button ripples.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div >
  );
}
