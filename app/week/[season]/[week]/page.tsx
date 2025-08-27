'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { isPicksLocked } from '@/lib/nfl';

interface Game {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  winnerTeam?: string;
}

interface Pick {
  gameId: number;
  pickedTeam: string;
}

interface User {
  name: string;
  userId: number;
}

export default function WeekPage({ params }: { params: { season: string; week: string } }) {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [myPicks, setMyPicks] = useState<Pick[]>([]);
  const [allPicks, setAllPicks] = useState<Record<string, Pick[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAllPicks, setShowAllPicks] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const season = parseInt(params.season);
  const week = parseInt(params.week);
  const isLocked = isPicksLocked(season, week);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, [season, week]);

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
    }
  };

  const fetchData = async () => {
    try {
      // Fetch games
      const gamesResponse = await fetch(`/api/schedule?season=${season}&week=${week}`);
      if (gamesResponse.ok) {
        const gamesData = await gamesResponse.json();
        setGames(gamesData.games);
      }

      // Fetch my picks
      const picksResponse = await fetch(`/api/picks/my?season=${season}&week=${week}`);
      if (picksResponse.ok) {
        const picksData = await picksResponse.json();
        setMyPicks(picksData.picks);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickChange = (gameId: number, pickedTeam: string) => {
    setMyPicks(prev => {
      const existing = prev.find(p => p.gameId === gameId);
      if (existing) {
        return prev.map(p => p.gameId === gameId ? { ...p, pickedTeam } : p);
      } else {
        return [...prev, { gameId, pickedTeam }];
      }
    });
  };

  const handleSubmit = async () => {
    if (myPicks.length === 0) {
      setError('Please make at least one pick');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/picks/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          season,
          week,
          picks: myPicks,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Picks submitted successfully!');
        await fetchData(); // Refresh data
      } else {
        setError(data.error || 'Failed to submit picks');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchAllPicks = async () => {
    try {
      const response = await fetch(`/api/picks/all?season=${season}&week=${week}`);
      if (response.ok) {
        const data = await response.json();
        setAllPicks(data.picksByUser);
        setShowAllPicks(true);
      } else {
        setError('You must submit your picks first to view others');
      }
    } catch (error) {
      setError('Error fetching picks');
    }
  };

  const getPickedTeam = (gameId: number) => {
    const pick = myPicks.find(p => p.gameId === gameId);
    return pick?.pickedTeam || '';
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
            <h1 className="text-3xl font-bold text-gray-900">
              Week {week} Picks
            </h1>
            <p className="text-gray-600">Season {season}</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Games and Picks */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Games</h2>
                
                {games.length === 0 ? (
                  <p className="text-gray-500">No games scheduled for this week.</p>
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
                        
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{game.awayTeam}</div>
                            <div className="text-sm font-medium">{game.homeTeam}</div>
                          </div>
                          
                          {!isLocked && game.status === 'scheduled' && (
                            <div className="flex space-x-2">
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`game-${game.id}`}
                                  value={game.awayTeam}
                                  checked={getPickedTeam(game.id) === game.awayTeam}
                                  onChange={(e) => handlePickChange(game.id, e.target.value)}
                                  className="mr-2"
                                />
                                <span className="text-sm">{game.awayTeam}</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`game-${game.id}`}
                                  value={game.homeTeam}
                                  checked={getPickedTeam(game.id) === game.homeTeam}
                                  onChange={(e) => handlePickChange(game.id, e.target.value)}
                                  className="mr-2"
                                />
                                <span className="text-sm">{game.homeTeam}</span>
                              </label>
                            </div>
                          )}
                          
                          {isLocked && (
                            <div className="text-sm text-gray-500">
                              {getPickedTeam(game.id) || 'No pick'}
                            </div>
                          )}
                        </div>
                        
                        {game.winnerTeam && (
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Winner: </span>
                            <span className="text-green-600">{game.winnerTeam}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* My Picks Panel */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">My Picks</h2>
                
                {myPicks.length === 0 ? (
                  <p className="text-gray-500">No picks submitted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {myPicks.map((pick) => {
                      const game = games.find(g => g.id === pick.gameId);
                      return (
                        <div key={pick.gameId} className="flex justify-between items-center py-2 border-b">
                          <div>
                            <div className="text-sm font-medium">
                              {game?.awayTeam} @ {game?.homeTeam}
                            </div>
                            <div className="text-xs text-gray-500">
                              {game && formatGameTime(game.startTime)}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-blue-600">
                            {pick.pickedTeam}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isLocked && myPicks.length === 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || myPicks.length === 0}
                    className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Picks'}
                  </button>
                )}

                {myPicks.length > 0 && !showAllPicks && (
                  <button
                    onClick={fetchAllPicks}
                    className="mt-4 w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                  >
                    View All Picks
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* All Picks Tab */}
          {showAllPicks && (
            <div className="mt-8 bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">All Picks</h2>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        {games.map((game) => (
                          <th key={game.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {game.awayTeam} @ {game.homeTeam}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(allPicks).map(([userName, picks]) => (
                        <tr key={userName}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {userName}
                          </td>
                          {games.map((game) => {
                            const pick = picks.find((p: Pick) => p.gameId === game.id);
                            return (
                              <td key={game.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {pick?.pickedTeam || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
