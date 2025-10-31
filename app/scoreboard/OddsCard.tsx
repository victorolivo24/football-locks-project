"use client";
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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

  if (err) return <div className="glass-card p-4 text-rose-100">Odds error: {err}</div>;
  if (!data) return <div className="glass-card p-4 text-slate-300">Loading odds…</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      className="glass-card p-4 space-y-4"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-slate-100 font-semibold text-lg">Title Odds</h3>
        <div className="text-xs text-slate-400">
          Remaining weeks: {data.remainingWeeks} · Avg picks/wk: {data.avgPicksPerWeek.toFixed(1)}
        </div>
      </div>

      <div className="space-y-2">
        {data.odds.map((r) => (
          <motion.div
            key={r.userId}
            className="space-y-1"
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.45 }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-slate-100">
                {r.name} <span className="text-xs text-indigo-200/80">({r.points} pts)</span>
              </span>
              <span className="tabular-nums text-cyan-200 font-semibold">{r.odds.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded">
              <motion.div
                className="h-2 rounded bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(100, Math.max(0, r.odds))}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Heuristic: odds rise when your lead exceeds the remaining swing (estimated from picks/week). Not gambling advice.
      </p>
    </motion.div>
  );
}
