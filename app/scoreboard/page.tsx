'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell, { PageHeader, useCurrentWeek } from '@/components/AppShell';
import OddsCard from './OddsCard';

interface UserScore {
  userId: number;
  name: string;
  totalScore: number;
  weeklyScores: Array<{ week: number; points: number }>;
}

export default function StandingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = useCurrentWeek();
  const [scores, setScores] = useState<UserScore[] | null>(null);

  const season = Number(searchParams.get('season')) || current?.season || null;

  useEffect(() => {
    if (!season) return;
    (async () => {
      const me = await fetch('/api/me').catch(() => null);
      if (!me?.ok) return router.push('/login');

      // Catch any results that landed since the last scheduled sweep.
      await fetch('/api/results/refresh', { method: 'POST' }).catch(() => undefined);
      const res = await fetch(`/api/scoreboard?season=${season}`);
      setScores(res.ok ? (await res.json()).scores || [] : []);
    })();
  }, [season, router]);

  const weeks = Math.max(0, ...(scores ?? []).flatMap(s => s.weeklyScores.map(w => w.week)));
  const leader = scores?.[0]?.totalScore ?? 0;

  return (
    <AppShell>
      <PageHeader eyebrow={season ? `Season ${season}` : undefined} title="Standings" />

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="space-y-2.5 lg:col-span-3">
          <h2 className="section-title">Leaderboard</h2>
          {scores === null ? (
            <div className="card p-6 text-center text-muted">Loading…</div>
          ) : scores.length === 0 ? (
            <div className="card p-6 text-center text-muted">No scores yet this season.</div>
          ) : (
            <div className="card divide-y divide-line">
              {scores.map((s, i) => (
                <div key={s.userId} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${
                      i === 0 ? 'bg-gold text-ink' : 'bg-raised text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{s.name.split(' ')[0]}</div>
                    <div className="mt-1 flex gap-1 overflow-x-auto">
                      {Array.from({ length: weeks }, (_, w) => {
                        const pts = s.weeklyScores.find(x => x.week === w + 1)?.points ?? 0;
                        return (
                          <span
                            key={w}
                            title={`Week ${w + 1}`}
                            className={`num shrink-0 rounded px-1.5 text-xs font-semibold ${
                              pts > 0 ? 'bg-win-soft text-win' : 'bg-white/5 text-muted'
                            }`}
                          >
                            W{w + 1} {pts}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-3xl font-bold leading-none">{s.totalScore}</div>
                    {i > 0 && leader > s.totalScore && (
                      <div className="text-[11px] text-muted">−{leader - s.totalScore}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2.5 lg:col-span-2">
          <h2 className="section-title">Title Odds</h2>
          {season && current && <OddsCard season={season} week={current.week} />}
        </section>
      </div>
    </AppShell>
  );
}
