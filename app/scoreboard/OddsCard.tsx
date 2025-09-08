"use client";
import { useEffect, useState } from 'react';

type OddsRow = { userId: number; name: string; points: number; margin: number; odds: number };
type OddsPayload = {
  season: number;
  week: number;
  remainingWeeks: number;
  avgPicksPerWeek: number;
  maxSwing: number;
  odds: OddsRow[];
};

export default function OddsCard({ season, week }: { season: number; week: number }) {
  const [data, setData] = useState<OddsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  if (err) return <div className="glass-card p-4 text-red-200">Odds error: {err}</div>;
  if (!data) return <div className="glass-card p-4 text-white/80">Loading odds…</div>;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-white font-semibold text-lg">Title Odds</h3>
        <div className="text-xs text-green-200/80">
          Remaining weeks: {data.remainingWeeks} · Avg picks/wk: {data.avgPicksPerWeek.toFixed(1)}
        </div>
      </div>

      <div className="space-y-2">
        {data.odds.map((r) => (
          <div key={r.userId} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-white">{r.name} <span className="text-xs text-green-200/80">({r.points} pts)</span></span>
              <span className="tabular-nums text-white">{r.odds.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded">
              <div className="h-2 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, r.odds))}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-green-200/80">
        Heuristic: odds rise when your lead exceeds the remaining swing (estimated from picks/week). Not gambling advice.
      </p>
    </div>
  );
}

