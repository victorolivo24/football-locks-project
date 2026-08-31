"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';
import { DateTime } from 'luxon';
import { normalizeTeam, isSameTeam } from '@/lib/teams';

interface Game {
  id: number;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  winnerTeam?: string | null;
}

interface PickItem {
  gameId: number;
  pickedTeam: string;
}

interface PicksByUser {
  [userName: string]: PickItem[];
}

interface UserRow { id: number; name: string }

export default function AllPicksPage({ params }: { params: { season: string; week: string } }) {
  const season = parseInt(params.season);
  const week = parseInt(params.week);
  const router = useRouter();

  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [picksByUser, setPicksByUser] = useState<PicksByUser>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'game' | 'player'>('player');

  useEffect(() => {
    (async () => {
      try {
        const [schedRes, picksRes] = await Promise.all([
          fetch(`/api/schedule?season=${season}&week=${week}`),
          fetch(`/api/picks/all?season=${season}&week=${week}`),
        ]);
        if (schedRes.ok) {
          const s = await schedRes.json();
          setGames(s.games || []);
        }
        if (picksRes.ok) {
          const p = await picksRes.json();
          setPicksByUser(p.picksByUser || {});
          setUsers(p.users || []);
        } else if (picksRes.status === 403) {
          const b = await picksRes.json().catch(() => ({}));
          setError(b.error || 'You must submit your picks first to view others');
        } else {
          setError('Unable to load picks');
        }
      } catch (e) {
        setError('Network error loading picks');
      } finally {
        setLoading(false);
      }
    })();
  }, [season, week]);

  const formatGameTime = (iso: string) =>
    DateTime.fromISO(iso).setZone('America/New_York').toFormat('EEE, MMM d, h:mm a');

  const isPickLoss = (p: PickItem) => {
    const g = games.find((g) => g.id === p.gameId) ||
              games.find((g) => isSameTeam(p.pickedTeam, g.homeTeam) || isSameTeam(p.pickedTeam, g.awayTeam));
    if (!g) return false;
    if (g.status !== 'final' || !g.winnerTeam) return false;
    return !isSameTeam(g.winnerTeam, p.pickedTeam);
  };

  const isUserBusted = (u: UserRow) => {
    const picks = picksByUser[u.name] || [];
    return picks.some((p) => isPickLoss(p));
  };

  const isUserPerfect = (u: UserRow) => {
    const picks = picksByUser[u.name] || [];
    if (picks.length === 0) return false;
    return picks.every((p) => {
      const g = games.find((g) => g.id === p.gameId) ||
                games.find((g) => isSameTeam(p.pickedTeam, g.homeTeam) || isSameTeam(p.pickedTeam, g.awayTeam));
      if (!g) return false;
      if (g.status !== 'final' || !g.winnerTeam) return false;
      return isSameTeam(g.winnerTeam, p.pickedTeam);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen max-w-2xl mx-auto p-6">
        <div className="glass-card p-6">
          <div className="text-red-200">{error}</div>
          <div className="mt-4">
            <Link href={`/week/${season}/${week}`} className="btn-blue px-4 py-2">Back to Week</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="relative glass-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href={`/week/${season}/${week}`} className="text-white hover:underline">← Back</Link>
              <span className="text-2xl font-bold text-white">All Picks</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">Season {season} • Week {week}</h1>
        </div>

        {users.length > 0 && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setViewMode('game')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${
                  viewMode === 'game' ? 'bg-yellow-500 text-black shadow-lg' : 'text-white/60 hover:text-white'
                }`}
              >
                Gameday View
              </button>
              <button
                onClick={() => setViewMode('player')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${
                  viewMode === 'player' ? 'bg-yellow-500 text-black shadow-lg' : 'text-white/60 hover:text-white'
                }`}
              >
                By Player
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {users.length === 0 ? (
            <div className="glass-card p-8 text-center text-green-200">
              No registered players found yet.
            </div>
          ) : viewMode === 'player' ? (
            users.map((u) => {
              const picks = picksByUser[u.name] || [];
              const has = picks.length > 0;
              const busted = isUserBusted(u);
              const perfect = isUserPerfect(u);
              
              return (
                <div key={u.id} className={`glass-card p-5 ${busted ? 'opacity-85' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white font-bold text-lg flex items-center gap-3">
                      <span>{u.name}</span>
                      {busted && (
                        <span className="text-red-300 text-xs font-semibold bg-red-900/40 px-2 py-1 rounded-full">Busted</span>
                      )}
                      {!busted && perfect && (
                        <span className="text-green-200 text-xs font-semibold bg-green-600/20 border border-green-500/30 px-2 py-1 rounded-full">Perfect</span>
                      )}
                    </div>
                    {!has && <div className="text-yellow-300 font-semibold">Hasn’t submitted yet</div>}
                  </div>
                  {has && (
                    <div className={`grid sm:grid-cols-2 gap-3`}>
                      {picks.map((p) => {
                        const g = games.find((g) => g.id === p.gameId) ||
                                 games.find((g) => isSameTeam(p.pickedTeam, g.homeTeam) || isSameTeam(p.pickedTeam, g.awayTeam));
                        if (!g) return null;
                        const loss = g.status === 'final' && g.winnerTeam && !isSameTeam(g.winnerTeam, p.pickedTeam);
                        const hit = g.status === 'final' && g.winnerTeam && isSameTeam(g.winnerTeam, p.pickedTeam);
                        const pickedHome = isSameTeam(p.pickedTeam, g.homeTeam);
                        const pickedAway = isSameTeam(p.pickedTeam, g.awayTeam);
                        return (
                          <div key={`${u.id}-${p.gameId}`} className={`glass-section p-3 sm:p-4 min-w-0 overflow-hidden ${loss ? 'opacity-70' : ''}`}>
                            <div className="flex items-center justify-between gap-3 min-w-0">
                              <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                                <div className={`flex items-center gap-1.5 min-w-0 ${pickedAway ? 'opacity-100 font-bold text-white' : 'opacity-60 text-white/70'}`}>
                                  <TeamLogo team={g.awayTeam} size="sm" />
                                  <span className="text-xs truncate max-w-[70px] sm:max-w-[90px]">{normalizeTeam(g.awayTeam)}</span>
                                </div>
                                <span className="text-white/60 font-semibold text-xs shrink-0">@</span>
                                <div className={`flex items-center gap-1.5 min-w-0 ${pickedHome ? 'opacity-100 font-bold text-white' : 'opacity-60 text-white/70'}`}>
                                  <TeamLogo team={g.homeTeam} size="sm" />
                                  <span className="text-xs truncate max-w-[70px] sm:max-w-[90px]">{normalizeTeam(g.homeTeam)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`bg-yellow-500 text-black px-2.5 py-0.5 rounded-full text-xs font-bold ${loss ? 'line-through bg-red-400 text-black' : ''}`}>
                                  🔒 {normalizeTeam(p.pickedTeam)}
                                </span>
                                {hit && (
                                  <span className="text-green-200 text-[10px] font-bold bg-green-600/20 border border-green-500/30 px-2 py-0.5 rounded-full shrink-0">
                                    HIT ✅
                                  </span>
                                )}
                                {loss && (
                                  <span className="text-red-200 text-[10px] font-bold bg-red-600/20 border border-red-500/30 px-2 py-0.5 rounded-full shrink-0">
                                    MISS ❌
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-green-300/80 mt-1.5 truncate">{formatGameTime(g.startTime)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="space-y-6 disco-container">
              <div className="disco-content">
              <div className="disco-card p-4 sm:p-6 mb-6">
                <h2 className="text-2xl font-disco text-pink-400 mb-2">Gameday Live</h2>
                <p className="text-sm text-cyan-100">
                  This view tracks picks game-by-game for players still in contention. 
                  Once a player misses a pick, they are eliminated for the week and their picks are removed from the remaining games.
                </p>
                
                {(() => {
                  const bustedUsers = users.filter(isUserBusted);
                  if (bustedUsers.length === 0) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h3 className="text-xs font-bold text-red-300 uppercase tracking-wider mb-3">
                        Eliminated Players ({bustedUsers.length})
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {bustedUsers.map(u => (
                          <div key={u.id} className="bg-red-900/30 border border-red-500/30 text-red-200 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
                            <span>❌</span> {u.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-4">
                {games.map((g) => {
                  // Find users who picked away team and are NOT busted on ANOTHER game
              const awayPickers = users.filter((u) => {
                const picks = picksByUser[u.name] || [];
                const thisPick = picks.find(p => p.gameId === g.id && isSameTeam(p.pickedTeam, g.awayTeam));
                if (!thisPick) return false;
                
                // If they busted on a different game, hide them
                const bustedOther = picks.some(p => p.gameId !== g.id && isPickLoss(p));
                return !bustedOther;
              });

              // Find users who picked home team and are NOT busted on ANOTHER game
              const homePickers = users.filter((u) => {
                const picks = picksByUser[u.name] || [];
                const thisPick = picks.find(p => p.gameId === g.id && isSameTeam(p.pickedTeam, g.homeTeam));
                if (!thisPick) return false;
                
                const bustedOther = picks.some(p => p.gameId !== g.id && isPickLoss(p));
                return !bustedOther;
              });

              const isFinal = g.status === 'final';
              const awayWon = isFinal && g.winnerTeam && isSameTeam(g.winnerTeam, g.awayTeam);
              const homeWon = isFinal && g.winnerTeam && isSameTeam(g.winnerTeam, g.homeTeam);

              return (
                <div key={g.id} className="disco-card p-0 overflow-hidden mb-4">
                  <div className="bg-black/50 px-4 py-3 border-b border-pink-500/30 flex items-center justify-between text-xs font-disco text-cyan-300">
                    <span className="font-medium tracking-wider">{formatGameTime(g.startTime)}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        isFinal
                          ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                          : g.status === 'in_progress'
                          ? 'bg-pink-500/30 text-pink-200 border border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.5)]'
                          : 'bg-cyan-600/30 text-cyan-100 border border-cyan-500/50'
                      }`}
                    >
                      {g.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 divide-x divide-white/5">
                    {/* Away Team Side */}
                    <div className={`p-4 ${isFinal && !awayWon ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <TeamLogo team={g.awayTeam} size="md" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-cyan-300 font-disco uppercase tracking-widest">Away</div>
                          <div className="font-bold text-white text-lg truncate font-disco">{normalizeTeam(g.awayTeam)}</div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {awayPickers.map(u => {
                          const hit = isFinal && awayWon;
                          const loss = isFinal && !awayWon;
                          return (
                            <div key={u.id} className="flex items-center justify-between disco-section px-3 py-2 rounded text-sm mb-1.5">
                              <span className="text-white font-medium truncate">{u.name}</span>
                              {hit && <span className="text-xs bg-green-500/20 text-green-300 px-1.5 rounded">✅</span>}
                              {loss && <span className="text-xs bg-red-500/20 text-red-300 px-1.5 rounded">❌</span>}
                            </div>
                          );
                        })}
                        {awayPickers.length === 0 && (
                          <div className="text-xs text-white/30 italic px-1">No picks</div>
                        )}
                      </div>
                    </div>

                    {/* Home Team Side */}
                    <div className={`p-4 ${isFinal && !homeWon ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <TeamLogo team={g.homeTeam} size="md" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-pink-300 font-disco uppercase tracking-widest">Home</div>
                          <div className="font-bold text-white text-lg truncate font-disco">{normalizeTeam(g.homeTeam)}</div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {homePickers.map(u => {
                          const hit = isFinal && homeWon;
                          const loss = isFinal && !homeWon;
                          return (
                            <div key={u.id} className="flex items-center justify-between disco-section px-3 py-2 rounded text-sm mb-1.5">
                              <span className="text-white font-medium truncate">{u.name}</span>
                              {hit && <span className="text-xs bg-green-500/20 text-green-300 px-1.5 rounded">✅</span>}
                              {loss && <span className="text-xs bg-red-500/20 text-red-300 px-1.5 rounded">❌</span>}
                            </div>
                          );
                        })}
                        {homePickers.length === 0 && (
                          <div className="text-xs text-white/30 italic px-1">No picks</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
