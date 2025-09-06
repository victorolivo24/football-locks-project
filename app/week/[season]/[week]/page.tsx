'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { isPicksLocked } from '@/lib/nfl';
import TeamLogo from '@/components/TeamLogo';

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
  const [picks, setPicks] = useState<Array<{ gameId: number; team?: string }>>([]);
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
    setPicks(prev => {
      const rest = prev.filter(p => p.gameId !== gameId);
      return [...rest, { gameId, team: pickedTeam }];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      season,
      week,
      picks: picks.filter(p => !!p.team).map(p => ({ gameId: p.gameId, pickedTeam: p.team! })),
    };

    if (payload.picks.length === 0) return alert('Select at least one game');

    setSubmitting(true);
    try {
      const res = await fetch('/api/picks/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      alert('Picks submitted!');
      location.reload();
    } catch (err: any) {
      alert(`Submit failed: ${err.message}`);
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
    const pick = picks.find(p => p.gameId === gameId);
    return pick?.team || '';
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

      <main className="relative max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Week {week} Picks
            </h1>
            <p className="text-xl text-green-200 mb-6">Season {season}</p>
            {isLocked && (
              <div className="inline-flex items-center px-6 py-3 bg-red-600/20 border border-red-500/30 rounded-full text-red-200 font-semibold">
                <span className="mr-2">🔒</span>
                Picks are locked for this week
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 bg-red-600/20 border border-red-500/30 text-red-200 px-6 py-4 rounded-xl backdrop-blur-sm">
              <div className="flex items-center">
                <span className="mr-2">⚠️</span>
                {error}
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-600/20 border border-green-500/30 text-green-200 px-6 py-4 rounded-xl backdrop-blur-sm">
              <div className="flex items-center">
                <span className="mr-2">✅</span>
                {success}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Games and Picks */}
            <div className="glass-card">
              <div className="px-6 py-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🏈</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Games</h2>
                </div>
                
                {games.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🏈</div>
                    <p className="text-green-200 text-lg">No games scheduled for this week.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {games.map((game) => (
                      <div key={game.id} className="glass-section p-6 hover:bg-white/10 transition-all duration-200">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-sm text-green-200 font-medium">
                            {formatGameTime(game.startTime)}
                          </span>
                          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                            game.status === 'final' ? 'bg-green-600/20 text-green-200 border border-green-500/30' :
                            game.status === 'in_progress' ? 'bg-yellow-600/20 text-yellow-200 border border-yellow-500/30' :
                            'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                          }`}>
                            {game.status.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <TeamLogo team={game.awayTeam} size="md" />
                            <span className="text-white font-semibold text-lg">@</span>
                            <TeamLogo team={game.homeTeam} size="md" />
                          </div>
                          
                          {!isLocked && game.status === 'scheduled' && (
                            <div className="flex space-x-4">
                              <label className="flex items-center cursor-pointer group">
                                <input
                                  type="radio"
                                  name={`pick-${game.id}`}
                                  value={game.awayTeam}
                                  checked={getPickedTeam(game.id) === game.awayTeam}
                                  onChange={() => handlePickChange(game.id, game.awayTeam)}
                                  className="sr-only"
                                />
                                <div className={`pick-radio ${
                                  getPickedTeam(game.id) === game.awayTeam 
                                    ? 'bg-yellow-500 border-yellow-400' 
                                    : 'border-white/30 group-hover:border-yellow-400 group-hover:bg-yellow-500/20'
                                }`}>
                                  {getPickedTeam(game.id) === game.awayTeam && (
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                  )}
                                </div>
                                <span className="ml-2 text-white font-medium group-hover:text-yellow-200 transition-colors">
                                  {game.awayTeam}
                                </span>
                              </label>
                              
                              <label className="flex items-center cursor-pointer group">
                                <input
                                  type="radio"
                                  name={`pick-${game.id}`}
                                  value={game.homeTeam}
                                  checked={getPickedTeam(game.id) === game.homeTeam}
                                  onChange={() => handlePickChange(game.id, game.homeTeam)}
                                  className="sr-only"
                                />
                                <div className={`pick-radio ${
                                  getPickedTeam(game.id) === game.homeTeam 
                                    ? 'bg-yellow-500 border-yellow-400' 
                                    : 'border-white/30 group-hover:border-yellow-400 group-hover:bg-yellow-500/20'
                                }`}>
                                  {getPickedTeam(game.id) === game.homeTeam && (
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                  )}
                                </div>
                                <span className="ml-2 text-white font-medium group-hover:text-yellow-200 transition-colors">
                                  {game.homeTeam}
                                </span>
                              </label>
                            </div>
                          )}
                          
                          {isLocked && (
                            <div className="text-sm text-green-200 font-medium">
                              {getPickedTeam(game.id) || 'No pick'}
                            </div>
                          )}
                        </div>
                        
                        {game.winnerTeam && (
                          <div className="flex items-center justify-center py-2 bg-green-600/20 border border-green-500/30 rounded-lg">
                            <span className="text-green-200 font-semibold">
                              🏆 Winner: {game.winnerTeam}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* My Picks Panel */}
            <div className="glass-card">
              <div className="px-6 py-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">My Picks</h2>
                </div>
                
                {myPicks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎯</div>
                    <p className="text-green-200 text-lg">No picks submitted yet.</p>
                    <p className="text-green-300 text-sm mt-2">Select teams above to make your picks!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myPicks.map((pick) => {
                      const game = games.find(g => g.id === pick.gameId);
                      return (
                        <div key={pick.gameId} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <TeamLogo team={game?.awayTeam || ''} size="sm" />
                              <span className="text-white font-medium">@</span>
                              <TeamLogo team={game?.homeTeam || ''} size="sm" />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-green-200 text-sm font-medium">Picked:</span>
                              <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                                {pick.pickedTeam}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-green-300 mt-2">
                            {game && formatGameTime(game.startTime)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isLocked && picks.filter(p => !!p.team).length > 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="mt-6 w-full btn-yellow py-4 px-6 hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-2 text-xl">🏈</span>
                      {submitting ? 'Submitting...' : 'Submit Picks'}
                    </span>
                  </button>
                )}

                {myPicks.length > 0 && !showAllPicks && (
                  <button
                    onClick={fetchAllPicks}
                    className="mt-4 w-full btn-blue py-3 px-6 hover:scale-105"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-2">👥</span>
                      View All Picks
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* All Picks Tab */}
          {showAllPicks && (
            <div className="mt-8 glass-card">
              <div className="px-6 py-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">All Picks</h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="px-4 py-4 text-left text-sm font-bold text-white uppercase tracking-wider">
                          Player
                        </th>
                        {games.map((game) => (
                          <th key={game.id} className="px-4 py-4 text-center text-xs font-medium text-green-200 uppercase tracking-wider">
                            <div className="flex items-center justify-center space-x-1">
                              <TeamLogo team={game.awayTeam} size="sm" />
                              <span className="text-white">@</span>
                              <TeamLogo team={game.homeTeam} size="sm" />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {Object.entries(allPicks).map(([userName, picks]) => (
                        <tr key={userName} className="hover:bg-white/5 transition-colors duration-200">
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-white">
                            {userName}
                          </td>
                          {games.map((game) => {
                            const pick = picks.find((p: Pick) => p.gameId === game.id);
                            return (
                              <td key={game.id} className="px-4 py-4 whitespace-nowrap text-center">
                                {pick?.pickedTeam ? (
                                  <div className="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold inline-block">
                                    {pick.pickedTeam}
                                  </div>
                                ) : (
                                  <span className="text-white/50 text-xs">-</span>
                                )}
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
    </div >
  );
}
