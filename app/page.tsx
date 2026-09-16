'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * No home screen: opening the app drops you where you would want to be.
 * Before lock that is This Week; once the week has locked it is Live.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const me = await fetch('/api/me').catch(() => null);
      if (!me?.ok) return router.replace('/login');

      const res = await fetch('/api/week').catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (!data?.season) return router.replace('/scoreboard');

      const locked = data.lockTime && Date.now() >= new Date(data.lockTime).getTime();
      router.replace(`/${locked ? 'picks' : 'week'}/${data.season}/${data.week}`);
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="font-display text-xl font-bold uppercase tracking-wide text-muted">Loading…</span>
    </div>
  );
}
