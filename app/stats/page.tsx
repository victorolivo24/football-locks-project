'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell, { PageHeader, useCurrentWeek } from '@/components/AppShell';
import TeamLogo from '@/components/TeamLogo';
import { SeasonInsightsData } from '@/lib/insights';

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
const deltaTag = (n: number, cut: number) => (n > cut ? 'tag-win' : n < -cut ? 'tag-loss' : 'tag-muted');

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h2 className="section-title">{title}</h2>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function StatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = useCurrentWeek();
  const [insights, setInsights] = useState<SeasonInsightsData | null>(null);

  const season = Number(searchParams.get('season')) || current?.season || null;

  useEffect(() => {
    if (!season) return;
    (async () => {
      const me = await fetch('/api/me').catch(() => null);
      if (!me?.ok) return router.push('/login');
      const res = await fetch(`/api/insights?season=${season}`);
      if (res.ok) setInsights(await res.json());
    })();
  }, [season, router]);

  if (!insights) {
    return (
      <AppShell>
        <PageHeader eyebrow={season ? `Season ${season}` : undefined} title="Stats" />
        <div className="card p-6 text-center text-muted">Loading…</div>
      </AppShell>
    );
  }

  const lucky = insights.players.filter(p => p.luck.gradedWeeks > 0).sort((a, b) => b.luck.delta - a.luck.delta);

  return (
    <AppShell>
      <PageHeader eyebrow={`Season ${season}`} title="Stats" />

      <div className="space-y-8">
        {insights.superlatives.length > 0 && (
          <Section title="Superlatives">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {insights.superlatives.map(s => (
                <div key={s.title} className="card p-3.5">
                  <div className="eyebrow">{s.icon} {s.title}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-xl font-bold uppercase">{s.playerName}</span>
                    <span className="num shrink-0 text-sm font-semibold text-gold">{s.stat}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{s.description}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {lucky.length > 0 && (
          <Section
            title="Luck Ledger"
            note="Expected points are what the closing lines said your tickets were worth. Positive means you've outscored the market."
          >
            <div className="card divide-y divide-line">
              {lucky.map(p => (
                <div key={p.userId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">
                    <span className="num text-text">{p.luck.actualPoints}</span> scored vs{' '}
                    <span className="num text-text">{p.luck.expectedPoints.toFixed(1)}</span> expected
                  </span>
                  <span className={`${deltaTag(p.luck.delta, 0.5)} num w-16 justify-center`}>{signed(p.luck.delta)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Players">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {insights.players.map((p, i) => (
              <div key={p.userId} className="card space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-2xl font-bold uppercase">{p.name}</span>
                      <span className="tag-muted num">#{i + 1}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {p.totalPoints} pts · {p.activeWeeks} {p.activeWeeks === 1 ? 'week' : 'weeks'} · {p.perfectWeeks} hit
                    </div>
                  </div>
                  {p.topTeams?.[0] && <TeamLogo team={p.topTeams[0].team} size="md" />}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Locks/wk', p.avgPicksPerWeek.toFixed(1)],
                    ['Hit rate', p.completedPicks > 0 ? `${p.pickWinPct}%` : '—'],
                    ['Best week', `${p.maxWeekScore}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-raised py-2">
                      <div className="num text-xl font-bold">{value}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-muted">
                    <span>Home {p.homePct}%</span>
                    <span>{p.homeTendency}</span>
                    <span>Away {p.awayPct}%</span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="bg-white/50" style={{ width: `${p.homePct}%` }} />
                    <div className="bg-white/15" style={{ width: `${p.awayPct}%` }} />
                  </div>
                </div>

                {p.topTeams && p.topTeams.length > 0 && (
                  <div className="flex items-center gap-3 border-t border-line pt-2.5 text-xs text-muted">
                    <span>Most locked</span>
                    {p.topTeams.map(t => (
                      <span key={t.team} className="flex items-center gap-1">
                        <TeamLogo team={t.team} size="sm" className="scale-75" />
                        <span className="num text-text">{t.count}×</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Team Ledger"
          note="Should win adds up each team's line every time someone locked it. vs line is real wins minus that."
        >
          {insights.teamLedger.length > 0 ? (
            <div className="card overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2.5 font-semibold">Team</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Locks</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Hit–Miss</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Should win</th>
                    <th className="px-3 py-2.5 text-center font-semibold">vs line</th>
                    <th className="px-4 py-2.5 font-semibold">Burned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {insights.teamLedger.map(row => (
                    <tr key={row.team}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <TeamLogo team={row.team} size="sm" />
                          <span className="font-semibold">{row.team}</span>
                        </div>
                      </td>
                      <td className="num px-3 py-2.5 text-center text-muted" title={`${row.games} ${row.games === 1 ? 'game' : 'games'}`}>
                        {row.locked}
                      </td>
                      <td className="num px-3 py-2.5 text-center font-semibold">{row.hits}–{row.misses}</td>
                      <td className="num px-3 py-2.5 text-center text-muted">{row.expectedHits.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`${deltaTag(row.edge, 0.25)} num`}>{signed(row.edge)}</span>
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-2.5 text-xs text-muted">
                        {row.victims.length > 0 ? row.victims.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-5 text-center text-sm text-muted">Nothing graded yet.</div>
          )}
        </Section>

        {insights.overlap.length > 0 && (
          <Section title="Who Copies Who" note="Share the leader's exact ticket and you can never gain ground.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {insights.overlap.slice(0, 9).map(pair => (
                <div
                  key={`${pair.a}-${pair.b}`}
                  className={`card flex items-center justify-between gap-2 px-3.5 py-2.5 ${pair.similarity >= 60 ? 'border-gold/40' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {pair.a} <span className="text-muted">&</span> {pair.b}
                    </div>
                    <div className="text-[11px] text-muted">
                      {pair.shared} identical {pair.shared === 1 ? 'lock' : 'locks'}
                    </div>
                  </div>
                  <span className={`num text-xl font-bold ${pair.similarity >= 60 ? 'text-gold' : pair.similarity <= 20 ? 'text-muted' : ''}`}>
                    {pair.similarity}%
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </AppShell>
  );
}
