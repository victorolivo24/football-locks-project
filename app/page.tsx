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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">NFL Pick'em</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Current Week Info */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-blue-900">Current Week</h3>
                  <p className="mt-2 text-3xl font-bold text-blue-600">
                    Week {weekInfo.week}
                  </p>
                  <p className="text-sm text-blue-700">Season {weekInfo.season}</p>
                </div>

                {/* Lock Countdown */}
                <div className="bg-red-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-red-900">Picks Lock In</h3>
                  <p className="mt-2 text-3xl font-bold text-red-600">
                    {timeUntilLock}
                  </p>
                  <p className="text-sm text-red-700">Thursday 8:00 PM ET</p>
                </div>

                {/* Status */}
                <div className="bg-green-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-green-900">Status</h3>
                  <p className="mt-2 text-3xl font-bold text-green-600">
                    {isLocked ? 'LOCKED' : 'OPEN'}
                  </p>
                  <p className="text-sm text-green-700">
                    {isLocked ? 'Picks are locked' : 'Picks are open'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/week/${weekInfo.season}/${weekInfo.week}`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {isLocked ? 'View Picks' : 'Make Picks'}
                </Link>
                
                <Link
                  href={`/scoreboard?season=${weekInfo.season}`}
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  View Scoreboard
                </Link>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
