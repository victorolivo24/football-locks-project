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
  winnerTeam?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        setGames(gamesData.games || []);
      }

      // Fetch my picks
      const picksResponse = await fetch(`/api/picks/my?season=${season}&week=${week}`);
      if (picksResponse.ok) {
        const picksData = await picksResponse.json();
        setMyPicks(picksData.picks || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickChange = (gameId: number, pickedTeam: string) => {
    if (isLocked || hasSubmitted) return;
    setPicks(prev => {
      const existing = prev.find(p => p.gameId === gameId);
      const rest = prev.filter(p => p.gameId !== gameId);

      // If user clicks the already selected team, uncheck / clear the pick
      if (existing && existing.team === pickedTeam) {
        return rest;
      }

      return [...rest, { gameId, team: pickedTeam }];
    });
  };

  const handleClearSinglePick = (gameId: number) => {
    if (isLocked || hasSubmitted) return;
    setPicks(prev => prev.filter(p => p.gameId !== gameId));
  };

  const handleClearAllDraftPicks = () => {
    if (isLocked || hasSubmitted) return;
    if (picks.length === 0) return;
    setPicks([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || hasSubmitted) return;

    const validPicks = picks.filter(p => !!p.team).map(p => ({ gameId: p.gameId, pickedTeam: p.team! }));

    if (validPicks.length === 0) {
      alert('Please select at least one game to submit.');
      return;
    }



    const payload = {
      season,
      week,
      picks: validPicks,
    };

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/picks/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSuccess('Picks submitted successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(`Submit failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getPickedTeam = (gameId: number) => {
    if (hasSubmitted) {
      const submittedPick = myPicks.find(p => p.gameId === gameId);
      return submittedPick?.pickedTeam || '';
    }
    const pick = picks.find(p => p.gameId === gameId);
    return pick?.team || '';
  };

  const formatGameTime = (startTime: string) => {
    return DateTime.fromISO(startTime).setZone('America/New_York').toFormat('EEE, MMM d, h:mm a');
  };

  const pickedCount = picks.filter(p => !!p.team).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white">Loading Week {week}...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen pb-12">
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

      <main className="relative max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            Week {week} Locks
          </h1>
          <p className="text-lg text-green-200 mb-4">Season {season}</p>
          {isLocked && (
            <div className="inline-flex items-center px-5 py-2.5 bg-red-600/20 border border-red-500/30 rounded-full text-red-200 font-semibold text-sm">
              <span className="mr-2">🔒</span>
              Picks are locked for this week (Thursday 8:00 PM ET deadline passed)
            </div>
          )}
          {!isLocked && hasSubmitted && (
            <div className="inline-flex items-center px-5 py-2.5 bg-green-600/20 border border-green-500/30 rounded-full text-green-200 font-semibold text-sm">
              <span className="mr-2">✅</span>
              You have submitted your picks for Week {week}
            </div>
          )}
          {!isLocked && !hasSubmitted && (
            <div className="inline-flex items-center px-5 py-2.5 bg-yellow-500/20 border border-yellow-400/40 rounded-full text-yellow-200 font-semibold text-sm">
              <span className="mr-2">⏳</span>
              Select your winners below and click Submit Picks before Thursday 8:00 PM ET
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Games and Picks (2 columns on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-xl">🏈</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Matchups</h2>
                    <p className="text-xs text-green-200">
                      {games.length} games scheduled this week
                    </p>
                  </div>
                </div>


              </div>

              {games.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🏈</div>
                  <p className="text-green-200 text-lg">No games scheduled for this week yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {games.map((game) => {
                    const currentPick = getPickedTeam(game.id);
                    const isAwayPicked = isSameTeam(currentPick, game.awayTeam);
                    const isHomePicked = isSameTeam(currentPick, game.homeTeam);
                    const isFinal = game.status === 'final';

                    return (
                      <div
                        key={game.id}
                        className="glass-section p-4 sm:p-5 hover:bg-white/10 transition-all duration-200 overflow-hidden"
                      >
                        {/* Game Header Bar */}
                        <div className="flex items-center justify-between mb-3 text-xs">
                          <span className="text-green-200 font-medium">
                            {formatGameTime(game.startTime)}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${
                              isFinal
                                ? 'bg-green-600/20 text-green-200 border border-green-500/30'
                                : game.status === 'in_progress'
                                ? 'bg-yellow-600/20 text-yellow-200 border border-yellow-500/30'
                                : 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                            }`}
                          >
                            {game.status}
                          </span>
                        </div>

                        {/* Pick Selection Grid */}
                        {!isLocked && !hasSubmitted && game.status === 'scheduled' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            {/* Away Team Pick Button */}
                            <button
                              type="button"
                              onClick={() => handlePickChange(game.id, game.awayTeam)}
                              className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left w-full min-w-0 ${
                                isAwayPicked
                                  ? 'bg-yellow-500/25 border-yellow-400 ring-2 ring-yellow-400/50 shadow-lg'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                              }`}
                            >
                              <div className="shrink-0">
                                <TeamLogo team={game.awayTeam} size="sm" />
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="text-[10px] text-green-300 font-semibold uppercase tracking-wider">Away</div>
                                <div className="text-sm font-bold text-white truncate">
                                  {game.awayTeam}
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isAwayPicked ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-black text-xs font-black shadow">
                                    🔒
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-white/20 text-transparent group-hover:border-yellow-400/50">
                                    •
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Home Team Pick Button */}
                            <button
                              type="button"
                              onClick={() => handlePickChange(game.id, game.homeTeam)}
                              className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left w-full min-w-0 ${
                                isHomePicked
                                  ? 'bg-yellow-500/25 border-yellow-400 ring-2 ring-yellow-400/50 shadow-lg'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                              }`}
                            >
                              <div className="shrink-0">
                                <TeamLogo team={game.homeTeam} size="sm" />
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="text-[10px] text-green-300 font-semibold uppercase tracking-wider">Home</div>
                                <div className="text-sm font-bold text-white truncate">
                                  {game.homeTeam}
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isHomePicked ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-black text-xs font-black shadow">
                                    🔒
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-white/20 text-transparent group-hover:border-yellow-400/50">
                                    •
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        ) : (
                          /* Locked / Submitted Display */
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                              <div className="flex items-center gap-3 min-w-0">
                                <TeamLogo team={game.awayTeam} size="sm" />
                                <span className={`text-sm font-bold truncate ${isAwayPicked ? 'text-yellow-400' : 'text-white'}`}>
                                  {game.awayTeam}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-green-300 px-2">@</span>
                              <div className="flex items-center gap-3 min-w-0 justify-end">
                                <span className={`text-sm font-bold truncate ${isHomePicked ? 'text-yellow-400' : 'text-white'}`}>
                                  {game.homeTeam}
                                </span>
                                <TeamLogo team={game.homeTeam} size="sm" />
                              </div>
                            </div>

                            {/* User Pick Tag */}
                            {currentPick && (
                              <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-400/30">
                                <span className="text-yellow-200 font-medium">Your Pick:</span>
                                <span className="font-bold text-yellow-300 flex items-center gap-1">
                                  <span>🔒</span> {currentPick}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Winner Banner if final */}
                        {game.winnerTeam && (
                          <div className="mt-3 flex items-center justify-center py-2 px-3 bg-green-600/20 border border-green-500/30 rounded-lg text-xs font-bold text-green-200">
                            🏆 Winner: {game.winnerTeam}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: My Picks & Actions */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">My Picks</h2>
                  <p className="text-xs text-green-200">
                    {hasSubmitted ? 'Submitted locks' : 'Current selections'}
                  </p>
                </div>
              </div>

              {!hasSubmitted && !isLocked ? (
                <div>
                  {pickedCount === 0 ? (
                    <div className="text-center py-8 text-green-200">
                      <div className="text-4xl mb-2">🎯</div>
                      <p className="font-medium text-sm">No picks selected yet.</p>
                      <p className="text-xs text-green-300 mt-1">Select a team in each matchup on the left.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center justify-between text-xs text-green-200 font-semibold mb-2">
                        <span>Selected {pickedCount} {pickedCount === 1 ? 'game' : 'games'}:</span>
                        <button
                          type="button"
                          onClick={handleClearAllDraftPicks}
                          className="text-red-300 hover:text-red-200 underline font-normal text-[11px]"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {picks.filter(p => !!p.team).map((p) => {
                          const g = games.find(game => game.id === p.gameId);
                          return (
                            <div
                              key={p.gameId}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs gap-2"
                            >
                              <span className="text-white/80 truncate max-w-[120px]">
                                {g ? `${normalizeTeam(g.awayTeam)} @ ${normalizeTeam(g.homeTeam)}` : `Game #${p.gameId}`}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/30 truncate max-w-[110px]">
                                  🔒 {normalizeTeam(p.team!)}
                                </span>
                                <button
                                  type="button"
                                  title="Remove pick"
                                  onClick={() => handleClearSinglePick(p.gameId)}
                                  className="text-white/50 hover:text-red-300 px-1 hover:bg-white/10 rounded"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {pickedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full btn-yellow py-3.5 px-6 font-bold text-base hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none shadow-xl"
                    >
                      <span className="flex items-center justify-center">
                        <span className="mr-2 text-xl">🔒</span>
                        {submitting
                          ? 'Submitting Picks...'
                          : `Submit ${pickedCount} Picks`}
                      </span>
                    </button>
                  )}
                </div>
              ) : myPicks.length === 0 ? (
                <div className="text-center py-8 text-green-200">
                  <div className="text-4xl mb-2">🔒</div>
                  <p className="font-medium text-sm">No picks submitted for this week.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-green-200 font-semibold mb-2">
                    Your {myPicks.length} Submitted Picks:
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {myPicks.map((pick) => {
                      let game = games.find(g => g.id === pick.gameId);
                      if (game && !(isSameTeam(pick.pickedTeam, game.homeTeam) || isSameTeam(pick.pickedTeam, game.awayTeam))) {
                        game = games.find(g => isSameTeam(pick.pickedTeam, g.homeTeam) || isSameTeam(pick.pickedTeam, g.awayTeam));
                      }
                      const isHit = !!(game && game.status === 'final' && game.winnerTeam && isSameTeam(game.winnerTeam, pick.pickedTeam));
                      const isLoss = !!(game && game.status === 'final' && game.winnerTeam && !isSameTeam(game.winnerTeam, pick.pickedTeam));

                      return (
                        <div
                          key={pick.gameId}
                          className={`p-3 rounded-xl border transition-colors ${
                            isHit
                              ? 'bg-green-600/15 border-green-500/30'
                              : isLoss
                              ? 'bg-red-600/15 border-red-500/30 opacity-80'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2 min-w-0">
                              <TeamLogo team={pick.pickedTeam} size="sm" />
                              <span className="font-bold text-white truncate max-w-[110px]">
                                {pick.pickedTeam}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isHit && (
                                <span className="text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">
                                  HIT ✅
                                </span>
                              )}
                              {isLoss && (
                                <span className="text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                                  LOSS ❌
                                </span>
                              )}
                              {!isHit && !isLoss && (
                                <span className="text-[10px] font-medium bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                                  {game?.status === 'in_progress' ? 'LIVE ⏳' : 'PENDING'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/10">
                <Link
                  href={`/picks/${season}/${week}`}
                  className="w-full btn-blue py-3 px-4 font-bold text-sm hover:scale-[1.02] inline-flex items-center justify-center shadow-lg"
                >
                  <span className="mr-2 text-lg">👥</span>
                  View League Picks & Standings
                </Link>
              </div>
            </div>

            {/* Scoring reminder card */}
            <div className="glass-section p-4 text-xs text-green-200/80 space-y-1.5">
              <div className="font-bold text-white text-sm mb-1">⚡ League Rules</div>
              <p>• Picks lock every <strong>Thursday at 8:00 PM ET</strong>.</p>
              <p>• <strong>All-or-Nothing</strong>: If all your picks hit, earn points equal to games picked. Any wrong pick = 0 points.</p>
              <p>• Opponents’ picks become visible after you submit your own picks.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
