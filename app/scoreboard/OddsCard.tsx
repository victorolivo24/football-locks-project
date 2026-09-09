"use client";
import { useEffect, useState } from 'react';

export type OddsRow = {
  userId: number;
  name: string;
  points: number;
  margin: number;
  odds: number;
  avgPicksPerWeek: number;
  projectedPoints: number;
  maxCeiling: number;
  leverageLocks: number;
  evLocks: number;
  edge: number;
  consensusOdds: number;
};

type OddsPayload = {
  season: number;
  week: number;
  remainingWeeks: number;
  avgPicksPerWeek: number;
  evLocks: number;
  odds: OddsRow[];
};

export default function OddsCard({ season, week }: { season: number; week: number }) {
  const [data, setData] = useState<OddsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const q = new URLSearchParams({ season: String(season), week: String(week) });
        const res = await fetch(`/api/odds?${q.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || res.statusText);
        setData(json);
      } catch (e: any) {
        setErr(e?.message ?? 'Failed to load odds');
      }
    })();
  }, [season, week]);

  if (err) return <div className="glass-card p-5 text-red-200">Odds error: {err}</div>;
  if (!data) return <div className="glass-card p-5 text-white/80 animate-pulse">Calculating personalized championship odds…</div>;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🏆</span>
            <h3 className="text-white font-bold text-lg tracking-wide">Championship Odds</h3>
          </div>
          <p className="text-xs text-green-200/80 mt-0.5">
            {data.remainingWeeks} weeks left, simulated 20,000 times
          </p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-colors"
        >
          {showDetails ? 'Hide Pace' : 'Show Pace'}
        </button>
      </div>

      <div className="space-y-3">
        {data.odds.map((r, index) => {
          const isLeader = index === 0;
          return (
            <div key={r.userId} className="space-y-1.5 group">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    isLeader ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/70'
                  }`}>
                    #{index + 1}
                  </span>
                  <span className="text-white font-medium truncate">{r.name}</span>
                  <span className="text-xs text-green-200/70 shrink-0 font-medium">({r.points} pts)</span>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  {showDetails && (
                    <span className="text-[11px] text-white/60 hidden sm:inline">
                      {r.avgPicksPerWeek?.toFixed(1) ?? '3.0'}/wk pace • Max {r.maxCeiling ?? (r.points + data.remainingWeeks * 3)}
                    </span>
                  )}
                  <span className="tabular-nums font-bold text-white text-sm">
                    {r.odds.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isLeader
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, r.odds))}%` }}
                />
              </div>

              {showDetails && (
                <div className="flex justify-between text-[10px] text-green-200/60 px-0.5 sm:hidden">
                  <span>Pace: {r.avgPicksPerWeek?.toFixed(1) ?? '3.0'} picks/wk</span>
                  <span>Max Ceiling: {r.maxCeiling ?? (r.points + data.remainingWeeks * 3)} pts</span>
                </div>
              )}

              {showDetails && r.leverageLocks > 0 && r.leverageLocks !== r.evLocks && (
                <div className="text-[10px] text-amber-300/90 px-0.5">
                  ⚡ Best play is {r.leverageLocks} locks, not the {r.evLocks} that maximises points —
                  needs the variance to catch up.
                </div>
              )}

              {showDetails && data.remainingWeeks > 0 && (
                <div className="text-[10px] px-0.5">
                  {Math.abs(r.edge) < 0.5 ? (
                    <span className="text-white/50">
                      🪞 Playing the field's ticket — same games as the pack, so this can't gain ground on them.
                    </span>
                  ) : r.edge > 0 ? (
                    <span className="text-green-300/90">
                      ↗ Breaking from the field is worth <strong>+{r.edge.toFixed(1)}</strong> title points
                      (vs {r.consensusOdds.toFixed(1)}% copying it).
                    </span>
                  ) : (
                    <span className="text-red-300/80">
                      ↘ Breaking from the field costs <strong>{r.edge.toFixed(1)}</strong> title points
                      (copying it would be {r.consensusOdds.toFixed(1)}%).
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-green-200/70">
        <span>⚡ Simulated off this week’s closing lines</span>
        <span>EV peak: {data.evLocks} locks/wk</span>
      </div>
    </div>
  );
}
