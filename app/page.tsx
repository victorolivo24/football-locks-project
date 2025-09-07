'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { getLockTime, isPicksLocked } from '@/lib/nfl';

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
      <nav className="relative glass-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-lg">🏈</span>
              </div>
              <h1 className="text-2xl font-bold text-white">NFL Pick'em</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-green-200 font-medium">Welcome, {user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-green-300 hover:text-white transition-colors duration-200 px-3 py-1 rounded-md hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              NFL Pick'em
            </h1>
            <p className="text-xl text-green-200 mb-6">
              Season {weekInfo.season} • Week {weekInfo.week}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
            {/* Current Week Info */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-2xl border border-blue-500/20">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
                <h3 className="text-lg font-semibold text-white">Current Week</h3>
              </div>
              <p className="text-4xl font-bold text-white mb-2">
                Week {weekInfo.week}
              </p>
              <p className="text-blue-200">Season {weekInfo.season}</p>
            </div>

            {/* Lock Countdown */}
            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-6 shadow-2xl border border-red-500/20">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⏰</span>
                </div>
                <h3 className="text-lg font-semibold text-white">Picks Lock In</h3>
              </div>
              <p className="text-3xl font-bold text-white mb-2">
                {timeUntilLock}
              </p>
              <p className="text-red-200">Thursday 8:00 PM ET</p>
            </div>

            {/* Status */}
            <div className={`rounded-xl p-6 shadow-2xl border ${
              isLocked 
                ? 'bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500/20' 
                : 'bg-gradient-to-br from-green-600 to-green-700 border-green-500/20'
            }`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl">{isLocked ? '🔒' : '✅'}</span>
                </div>
                <h3 className="text-lg font-semibold text-white">Status</h3>
              </div>
              <p className="text-3xl font-bold text-white mb-2">
                {isLocked ? 'LOCKED' : 'OPEN'}
              </p>
              <p className="text-white/80">
                {isLocked ? 'Picks are locked' : 'Picks are open'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/week/${weekInfo.season}/${weekInfo.week}`}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl shadow-2xl hover:from-yellow-400 hover:to-yellow-500 transform hover:scale-105 transition-all duration-200 border-2 border-yellow-400/50"
            >
              <span className="mr-2 text-2xl">🏈</span>
              {isLocked ? 'View Picks' : 'Make Picks'}
              <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </Link>
            
            <Link
              href={`/scoreboard?season=${weekInfo.season}`}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-green-900 bg-gradient-to-r from-white to-gray-100 rounded-xl shadow-2xl hover:from-gray-100 hover:to-white transform hover:scale-105 transition-all duration-200 border-2 border-white/50"
            >
              <span className="mr-2 text-2xl">🏆</span>
              View Scoreboard
              <div className="absolute inset-0 bg-green-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </Link>

            <Link
              href={`/picks/${weekInfo.season}/${weekInfo.week}`}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-2xl hover:from-blue-500 hover:to-blue-600 transform hover:scale-105 transition-all duration-200 border-2 border-blue-500/30"
            >
              <span className="mr-2 text-2xl">👥</span>
              All Picks
              <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </Link>

            {/* Admin link removed for deployment */}
          </div>
        </div>
      </main>
    </div >
  );
}
