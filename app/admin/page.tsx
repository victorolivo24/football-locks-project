'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';

interface Game {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  winnerTeam?: string;
}

interface User {
  name: string;
  userId: number;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passcode, setPasscode] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<number>(2024);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchGames();
    }
  }, [user, selectedSeason, selectedWeek]);

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

  const fetchGames = async () => {
    try {
      const response = await fetch(`/api/schedule?season=${selectedSeason}&week=${selectedWeek}`);
      if (response.ok) {
        const data = await response.json();
        setGames(data.games);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
    }
  };

  const handleUpdateResult = async (gameId: number, winnerTeam: string, status: string) => {
    if (!passcode) {
      setError('Please enter admin passcode');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/manual-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passcode,
          gameId,
          winnerTeam,
          status,
          season: selectedSeason,
          week: selectedWeek,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Game result updated successfully!');
        await fetchGames(); // Refresh games
      } else {
        setError(data.error || 'Failed to update game result');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatGameTime = (startTime: string) => {
    return DateTime.fromISO(startTime).setZone('America/New_York').toFormat('EEE, MMM d, h:mm a');
  };

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
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600">Manually update game results</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Admin Passcode */}
          <div className="mb-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Admin Access</h2>
            <div className="max-w-md">
              <label htmlFor="passcode" className="block text-sm font-medium text-gray-700">
                Admin Passcode
              </label>
              <input
                type="password"
                id="passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter admin passcode"
              />
            </div>
          </div>

          {/* Week Selection */}
          <div className="mb-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Select Week</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label htmlFor="season" className="block text-sm font-medium text-gray-700">
                  Season
                </label>
                <select
                  id="season"
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                </select>
              </div>
              <div>
                <label htmlFor="week" className="block text-sm font-medium text-gray-700">
                  Week
                </label>
                <select
                  id="week"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
                    <option key={week} value={week}>
                      Week {week}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Games */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Games - Season {selectedSeason}, Week {selectedWeek}
              </h2>
              
              {games.length === 0 ? (
                <p className="text-gray-500">No games found for this week.</p>
              ) : (
                <div className="space-y-4">
                  {games.map((game) => (
                    <div key={game.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">
                          {formatGameTime(game.startTime)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          game.status === 'final' ? 'bg-green-100 text-green-800' :
                          game.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {game.status}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-sm font-medium">{game.awayTeam} @ {game.homeTeam}</div>
                        {game.winnerTeam && (
                          <div className="text-sm text-green-600 mt-1">
                            Winner: {game.winnerTeam}
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Winner
                          </label>
                          <div className="flex space-x-4">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`winner-${game.id}`}
                                value={game.awayTeam}
                                className="mr-2"
                              />
                              <span className="text-sm">{game.awayTeam}</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name={`winner-${game.id}`}
                                value={game.homeTeam}
                                className="mr-2"
                              />
                              <span className="text-sm">{game.homeTeam}</span>
                            </label>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            id={`status-${game.id}`}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            defaultValue={game.status}
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="final">Final</option>
                          </select>
                        </div>
                        
                        <button
                          onClick={() => {
                            const winnerRadio = document.querySelector(`input[name="winner-${game.id}"]:checked`) as HTMLInputElement;
                            const statusSelect = document.getElementById(`status-${game.id}`) as HTMLSelectElement;
                            
                            if (!winnerRadio) {
                              setError('Please select a winner');
                              return;
                            }
                            
                            handleUpdateResult(game.id, winnerRadio.value, statusSelect.value);
                          }}
                          disabled={submitting}
                          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {submitting ? 'Updating...' : 'Update Result'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
