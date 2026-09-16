'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, password, mode }),
      });

      const data = await response.json();

      if (response.ok) {
        if (mode === 'register') {
          setSuccess('Account created! Entering league...');
          setTimeout(() => router.push('/'), 600);
        } else {
          router.push('/');
        }
      } else {
        setError(data.error || (mode === 'register' ? 'Failed to create account' : 'Login failed'));
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  const input = 'w-full rounded-lg border border-line bg-raised px-3.5 py-3 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-3xl">🔒</div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide">NFL Locks</h1>
          <p className="text-sm text-muted">All or nothing, every week.</p>
        </div>

        <div className="card p-5">
          <div className="flex rounded-lg bg-raised p-1">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  mode === m ? 'bg-gold text-ink' : 'text-muted hover:text-text'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Create account'}
              </button>
            ))}
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="eyebrow mb-1.5 block">Name</label>
              <input
                id="name"
                name="name"
                required
                autoComplete="name"
                className={input}
                placeholder={mode === 'login' ? 'e.g. Victor' : 'Shown on the standings'}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="eyebrow mb-1.5 block">
                Password <span className="normal-case tracking-normal text-muted">(optional)</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={input}
                placeholder={mode === 'login' ? 'Leave blank if you never set one' : 'Protects your picks'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <div className="rounded-lg bg-loss-soft px-3 py-2.5 text-center text-sm text-loss">{error}</div>}
            {success && <div className="rounded-lg bg-win-soft px-3 py-2.5 text-center text-sm text-win">{success}</div>}

            <button type="submit" disabled={loading || !name.trim()} className="btn-primary w-full py-3 disabled:opacity-50">
              {loading
                ? mode === 'register' ? 'Creating account…' : 'Signing in…'
                : mode === 'register' ? 'Create account' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
