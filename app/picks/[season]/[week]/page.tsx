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

        <div className="space-y-4">
          {users.map((u) => {
            const picks = picksByUser[u.name] || [];
            const has = picks.length > 0;
            const isPickLoss = (p: PickItem) => {
              const g = games.find((g) => g.id === p.gameId) ||
                        games.find((g) => isSameTeam(p.pickedTeam, g.homeTeam) || isSameTeam(p.pickedTeam, g.awayTeam));
              if (!g) return false;
              if (g.status !== 'final' || !g.winnerTeam) return false;
              return !isSameTeam(g.winnerTeam, p.pickedTeam);
            };
            const busted = has && picks.some((p) => isPickLoss(p));
            // Perfect if user has picks and every pick corresponds to a final game and matches the winner
            const perfect = has && picks.every((p) => {
              const g = games.find((g) => g.id === p.gameId) ||
                        games.find((g) => isSameTeam(p.pickedTeam, g.homeTeam) || isSameTeam(p.pickedTeam, g.awayTeam));
              if (!g) return false;
              if (g.status !== 'final' || !g.winnerTeam) return false;
              return isSameTeam(g.winnerTeam, p.pickedTeam);
            });
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
                        <div key={`${u.id}-${p.gameId}`} className={`glass-section p-4 ${loss ? 'line-through opacity-70' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                              <div className={`flex flex-col items-center ${pickedAway ? 'opacity-100' : 'opacity-70'}`}>
                                <TeamLogo team={g.awayTeam} size="sm" />
                                <span className="text-green-200 text-[11px] mt-1 text-center max-w-[80px] truncate">{normalizeTeam(g.awayTeam)}</span>
                              </div>
                              <span className="text-white font-semibold">@</span>
                              <div className={`flex flex-col items-center ${pickedHome ? 'opacity-100' : 'opacity-70'}`}>
                                <TeamLogo team={g.homeTeam} size="sm" />
                                <span className="text-green-200 text-[11px] mt-1 text-center max-w-[80px] truncate">{normalizeTeam(g.homeTeam)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold`}>{normalizeTeam(p.pickedTeam)}</span>
                              {hit && (
                                <span className="text-green-200 text-[10px] font-semibold bg-green-600/20 border border-green-500/30 px-2 py-0.5 rounded-full">HIT</span>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] text-green-300 mt-2">{formatGameTime(g.startTime)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
