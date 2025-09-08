'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { isPicksLocked } from '@/lib/nfl';
import TeamLogo from '@/components/TeamLogo';
import { isSameTeam, normalizeTeam } from '@/lib/teams';

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
  const hasSubmitted = myPicks.length > 0;

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
                  <span className="text-black font-bold text-lg">🔒</span>
                </div>
                <span className="text-2xl font-bold text-white">NFL Locks</span>
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
              Week {week} Locks
            </h1>
            <p className="text-xl text-green-200 mb-6">Season {season}</p>
            {isLocked && (
              <div className="inline-flex items-center px-6 py-3 bg-red-600/20 border border-red-500/30 rounded-full text-red-200 font-semibold">
                <span className="mr-2">🔒</span>
                Picks are locked for this week
              </div>
            )}
            {!isLocked && hasSubmitted && (
              <div className="inline-flex items-center px-6 py-3 bg-green-600/20 border border-green-500/30 rounded-full text-green-200 font-semibold">
                <span className="mr-2">✅</span>
                You already submitted your picks
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
                    <span className="text-2xl">🔒</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Games</h2>
                </div>
                
                {games.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔒</div>
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
                          <div className="flex items-center space-x-6">
                            <div className="flex flex-col items-center">
                              <TeamLogo team={game.awayTeam} size="md" />
                              <span className="text-green-200 text-xs mt-1 max-w-[80px] text-center truncate">{normalizeTeam(game.awayTeam)}</span>
                            </div>
                            <span className="text-white font-semibold text-lg">@</span>
                            <div className="flex flex-col items-center">
                              <TeamLogo team={game.homeTeam} size="md" />
                              <span className="text-green-200 text-xs mt-1 max-w-[80px] text-center truncate">{normalizeTeam(game.homeTeam)}</span>
                            </div>
                          </div>
                          
                          {!isLocked && !hasSubmitted && game.status === 'scheduled' && (
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
                      // Find the game by id; if team mismatch, fall back to matching by team
                      let game = games.find(g => g.id === pick.gameId);
                      if (game && !(isSameTeam(pick.pickedTeam, game.homeTeam) || isSameTeam(pick.pickedTeam, game.awayTeam))) {
                        game = games.find(g => isSameTeam(pick.pickedTeam, g.homeTeam) || isSameTeam(pick.pickedTeam, g.awayTeam));
                      }
                      const isHit = !!(game && game.status === 'final' && game.winnerTeam && isSameTeam(game.winnerTeam, pick.pickedTeam));
                      return (
                        <div key={pick.gameId} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                              <div className="flex flex-col items-center">
                                <TeamLogo team={game?.awayTeam || ''} size="sm" />
                                <span className="text-green-200 text-[10px] mt-1 max-w-[60px] text-center truncate">{game ? normalizeTeam(game.awayTeam) : ''}</span>
                              </div>
                              <span className="text-white font-medium">@</span>
                              <div className="flex flex-col items-center">
                                <TeamLogo team={game?.homeTeam || ''} size="sm" />
                                <span className="text-green-200 text-[10px] mt-1 max-w-[60px] text-center truncate">{game ? normalizeTeam(game.homeTeam) : ''}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-green-200 text-sm font-medium">Picked:</span>
                              <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                                {pick.pickedTeam}
                              </div>
                              {isHit && (
                                <span className="ml-2 text-green-200 text-xs font-semibold bg-green-600/20 border border-green-500/30 px-2 py-1 rounded-full">HIT</span>
                              )}
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

                {!isLocked && !hasSubmitted && picks.filter(p => !!p.team).length > 0 && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="mt-6 w-full btn-yellow py-4 px-6 hover:scale-105 disabled:opacity-50 disabled:transform-none"
                  >
                    <span className="flex items-center justify-center">
                <span className="mr-2 text-xl">🔒</span>
                      {submitting ? 'Submitting...' : 'Submit Picks'}
                    </span>
                  </button>
                )}

                <Link
                  href={`/picks/${season}/${week}`}
                  className="mt-4 w-full btn-blue py-3 px-6 hover:scale-105 inline-flex items-center justify-center"
                >
                  <span className="mr-2">👥</span>
                  View All Picks
                </Link>
              </div>
            </div>
          </div>

          {/* All Picks moved to its own page at /picks/[season]/[week] */}
        </div>
      </main>
    </div >
  );
}
