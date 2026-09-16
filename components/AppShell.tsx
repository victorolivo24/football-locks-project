'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import NotificationSetup from '@/components/NotificationSetup';

interface CurrentWeek {
  season: number;
  week: number;
}

/** The live season and week, shared by every tab link. */
export function useCurrentWeek(): CurrentWeek | null {
  const [current, setCurrent] = useState<CurrentWeek | null>(null);
  useEffect(() => {
    fetch('/api/week')
      .then(res => (res.ok ? res.json() : null))
      .then(data => data?.season && setCurrent({ season: data.season, week: data.week }))
      .catch(() => undefined);
  }, []);
  return current;
}

const TABS = [
  { key: 'week', label: 'This Week', icon: '🏈', match: '/week' },
  { key: 'live', label: 'Live', icon: '📡', match: '/picks' },
  { key: 'standings', label: 'Standings', icon: '🏆', match: '/scoreboard' },
  { key: 'stats', label: 'Stats', icon: '📊', match: '/stats' },
] as const;

function hrefFor(key: (typeof TABS)[number]['key'], current: CurrentWeek | null) {
  if (key === 'standings') return '/scoreboard';
  if (key === 'stats') return '/stats';
  if (!current) return '/';
  return `/${key === 'week' ? 'week' : 'picks'}/${current.season}/${current.week}`;
}

/**
 * Every signed-in page sits inside this: a slim header, four tabs, and a
 * settings sheet. Tabs are organised by when you would open them — before
 * lock, during games, and any time — rather than by kind of data.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = useCurrentWeek();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  };

  const tabs = TABS.map(tab => ({
    ...tab,
    href: hrefFor(tab.key, current),
    active: pathname.startsWith(tab.match),
  }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold text-sm">🔒</span>
            <span className="font-display text-xl font-extrabold uppercase tracking-wide">NFL Locks</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map(tab => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  tab.active ? 'bg-white/10 text-text' : 'text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-muted hover:bg-white/5 hover:text-text"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:pb-12">{children}</main>

      {/* Phone tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4">
          {tabs.map(tab => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                tab.active ? 'text-gold' : 'text-muted'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSettingsOpen(false)} />
          <div className="relative h-full w-full max-w-md space-y-4 overflow-y-auto border-l border-line bg-ink p-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="btn-ghost px-3 py-1.5 text-xs">
                Close
              </button>
            </div>
            <NotificationSetup />
            <div className="card divide-y divide-line">
              <Link href="/admin" className="block px-4 py-3 text-sm font-semibold hover:bg-white/5">
                Admin tools
              </Link>
              <button onClick={logout} className="block w-full px-4 py-3 text-left text-sm font-semibold text-loss hover:bg-white/5">
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Title block at the top of a tab. */
export function PageHeader({ eyebrow, title, right }: { eyebrow?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide sm:text-4xl">{title}</h1>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
