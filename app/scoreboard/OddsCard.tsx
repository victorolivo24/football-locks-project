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
  projectedFinish: number;
};

type OddsPayload = {
  season: number;
  week: number;
  remainingWeeks: number;
  avgPicksPerWeek: number;
  par: number;
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

  if (err) return <div className="card p-4 text-sm text-loss">Couldn&apos;t load title odds: {err}</div>;
  if (!data) return <div className="card p-4 text-sm text-muted">Simulating the rest of the season…</div>;

  const top = Math.max(1, ...data.odds.map(r => r.odds));

  return (
    <div className="card p-4">
      <div className="space-y-3">
        {data.odds.map((r, i) => (
          <div key={r.userId}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">{r.name.split(' ')[0]}</span>
              <span className={`num text-xl font-bold ${i === 0 ? 'text-gold' : ''}`}>{r.odds.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${i === 0 ? 'bg-gold' : 'bg-white/30'}`}
                style={{ width: `${Math.max(2, (r.odds / top) * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {r.points} pts now · finishing ~{r.projectedFinish} · {r.avgPicksPerWeek.toFixed(1)} locks/wk
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-line pt-3 text-[11px] text-muted">
        {data.remainingWeeks} weeks left, simulated 20,000 times off this week&apos;s lines · Par {data.par} pts (2024)
      </p>
    </div>
  );
}
