'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DateTime } from 'luxon';
import TeamLogo from '@/components/TeamLogo';
import { normalizeTeam } from '@/lib/teams';

interface Game {
  id: number;
  season: number;
  week: number;
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  winnerTeam?: string | null;
  status: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');

  const [season, setSeason] = useState(2026);
  const [week, setWeek] = useState(1);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingGameId, setSavingGameId] = useState<number | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const finalCount = useMemo(
    () => games.filter((game) => game.status === 'final' && game.winnerTeam).length,
    [games]
  );

  useEffect(() => {
    fetch('/api/week')
      .then((response) => response.json())
      .then((data) => {
        if (data.season) setSeason(data.season);
        if (data.week) setWeek(data.week);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchGames();
    }
  }, [season, week, isAuthenticated]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const trimmed = inputPassword.trim();
    if (trimmed.toLowerCase() === 'victor') {
      setPasscode(trimmed);
      setIsAuthenticated(true);
      setInputPassword('');
    } else {
      setAuthError('Incorrect admin password.');
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    setPasscode('');
    setInputPassword('');
    setMessage('');
    setError('');
  };

  const fetchGames = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/schedule?season=${season}&week=${week}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load schedule');
      }

      setGames(data.games || []);
    } catch (error: any) {
      setError(error.message || 'Unable to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleWinnerClick = async (game: Game, team: string) => {
    const isClearing = game.status === 'final' && game.winnerTeam === team;
    const newWinner = isClearing ? null : team;
    const newStatus = isClearing ? 'scheduled' : 'final';

    setSavingGameId(game.id);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/manual-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode,
          gameId: game.id,
          winnerTeam: newWinner,
          status: newStatus,
          season,
          week,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save winner');
      }

      setGames((current) =>
        current.map((item) =>
          item.id === game.id ? { ...item, winnerTeam: newWinner, status: newStatus } : item
        )
      );
      setMessage(isClearing ? `Reset winner for game ${game.awayTeam} @ ${game.homeTeam}` : `Saved ${team} as winner.`);
    } catch (error: any) {
      setError(error.message || 'Unable to save winner');
    } finally {
      setSavingGameId(null);
    }
  };

  const handleRecalculateScores = async () => {
    setRecomputing(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/manual-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode,
          season,
          week,
          recomputeOnly: true,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to recalculate scores');
      }

      setMessage(`Recalculated scores for Season ${season} Week ${week}!`);
    } catch (err: any) {
      setError(err.message || 'Error recalculating scores');
    } finally {
      setRecomputing(false);
    }
  };

  const handleClearPicks = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to CLEAR ALL PICKS for Season ${season} Week ${week}? This will allow users to submit picks again.`
    );
    if (!confirmed) return;

    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/reset-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode,
          season,
          week,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to clear picks');
      }

      setMessage(`Picks and scores cleared for Season ${season} Week ${week}! Users can now submit new picks.`);
    } catch (err: any) {
      setError(err.message || 'Error clearing picks');
    }
  };

  const formatGameTime = (startTime: string) =>
    DateTime.fromISO(startTime).setZone('America/New_York').toFormat('EEE, MMM d, h:mm a');

  // LOCKED STATE: Show password gate only
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="relative max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-black font-bold text-3xl">🔒</span>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Admin Access
              </h1>
              <p className="text-green-200 text-sm mb-6">
                Enter the admin password to manage games, winners, and scores.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-green-100 mb-2" htmlFor="admin-password">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoFocus
                  required
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-white placeholder-green-100/50 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm backdrop-blur-sm"
                  placeholder="Enter admin password"
                />
              </div>

              {authError && (
                <div className="rounded-xl border border-red-500/30 bg-red-600/20 text-red-200 px-4 py-3 text-xs sm:text-sm text-center">
                  ⚠️ {authError}
                </div>
              )}

              <button
                type="submit"
                className="w-full btn-yellow py-3.5 px-6 font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
              >
                Unlock Admin Tools
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <Link href="/" className="text-sm text-green-300 hover:text-white transition-colors">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE: Show full Admin Panel
  return (
    <div className="min-h-screen">
      <nav className="relative glass-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white hover:underline">← Back to Dashboard</Link>
              <h1 className="text-2xl font-bold text-white">Admin Results Panel</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLock}
                className="text-xs text-yellow-400 border border-yellow-400/40 rounded-lg px-3 py-1.5 hover:bg-yellow-400/10 transition-colors font-bold"
              >
                🔒 Lock Admin
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Controls Header */}
        <div className="glass-card p-6 mb-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr] items-end">
            <div>
              <label className="block text-sm font-semibold text-green-100 mb-2" htmlFor="season">
                Season
              </label>
              <input
                id="season"
                type="number"
                value={season}
                onChange={(event) => setSeason(Number(event.target.value))}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-green-100 mb-2" htmlFor="week">
                Week
              </label>
              <select
                id="week"
                value={week}
                onChange={(event) => setWeek(Number(event.target.value))}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                {Array.from({ length: 18 }, (_, index) => index + 1).map((weekNumber) => (
                  <option key={weekNumber} value={weekNumber} className="text-gray-900">
                    Week {weekNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-green-100">
              <span className="font-bold text-yellow-400">{finalCount}</span> of <span className="font-bold text-white">{games.length}</span> games marked final. Scores automatically recompute when games update.
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleRecalculateScores}
                disabled={recomputing}
                className="btn-yellow px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                {recomputing ? 'Recalculating...' : '🔄 Recalculate Scores'}
              </button>
              <button
                type="button"
                onClick={handleClearPicks}
                className="rounded-xl border border-red-500/40 bg-red-600/20 hover:bg-red-600/30 text-red-200 px-4 py-2 text-sm font-bold transition-all"
              >
                🗑️ Clear Week Picks
              </button>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div className={`mb-6 rounded-xl border px-4 py-3 ${error ? 'border-red-500/30 bg-red-600/20 text-red-100' : 'border-green-500/30 bg-green-600/20 text-green-100'}`}>
            <div className="flex items-center">
              <span className="mr-2">{error ? '⚠️' : '✅'}</span>
              <span>{error || message}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-white text-center py-12">Loading schedule...</div>
        ) : games.length === 0 ? (
          <div className="glass-card p-8 text-center text-green-200">
            No games found for Season {season} Week {week}.
          </div>
        ) : (
          <div className="grid gap-4">
            {games.map((game) => {
              const isFinal = game.status === 'final' && !!game.winnerTeam;
              return (
                <div key={game.id} className="glass-card p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-semibold text-green-300">
                          {formatGameTime(game.startTime)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isFinal
                            ? 'bg-green-600/20 text-green-200 border border-green-500/30'
                            : 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                        }`}>
                          {game.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <TeamLogo team={game.awayTeam} size="sm" />
                          <span className="text-white font-bold text-base">{game.awayTeam}</span>
                        </div>
                        <span className="text-green-300 font-bold">@</span>
                        <div className="flex items-center gap-2">
                          <TeamLogo team={game.homeTeam} size="sm" />
                          <span className="text-white font-bold text-base">{game.homeTeam}</span>
                        </div>
                      </div>

                      <div className="text-xs text-green-200 mt-2">
                        {isFinal ? (
                          <span className="text-yellow-400 font-semibold">
                            🏆 Winner: {game.winnerTeam} (click to toggle off)
                          </span>
                        ) : (
                          <span className="text-white/60">Click a team below to set winner & mark final</span>
                        )}
                      </div>
                    </div>

                    {/* Team Winner Selection Buttons */}
                    <div className="grid grid-cols-2 gap-2 sm:min-w-[340px]">
                      {[game.awayTeam, game.homeTeam].map((team) => {
                        const isWinner = game.winnerTeam === team;
                        return (
                          <button
                            key={team}
                            type="button"
                            disabled={savingGameId === game.id}
                            onClick={() => handleWinnerClick(game, team)}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all disabled:opacity-50 min-w-0 ${
                              isWinner
                                ? 'border-yellow-400 bg-yellow-500 text-black shadow-lg ring-2 ring-yellow-400/50'
                                : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                            }`}
                          >
                            <span className="truncate">{normalizeTeam(team)}</span>
                            {isWinner && <span className="shrink-0 text-xs">🏆</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
