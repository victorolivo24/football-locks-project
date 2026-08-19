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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="relative max-w-md w-full space-y-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-6 sm:p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-black font-bold text-3xl">🔒</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">
              NFL Locks
            </h1>
            <p className="text-green-200 text-sm sm:text-base">
              {mode === 'login' ? 'Welcome back! Sign in to make your locks.' : 'Join the league and start making picks!'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-black/20 p-1 mt-6 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-yellow-500 text-black shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-yellow-500 text-black shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
          
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-green-100 mb-2">
                Your Name
              </label>
              <input
                id="name"
                name="name"
                required
                autoComplete="name"
                className="w-full px-4 py-3 bg-white/10 border border-white/30 text-white placeholder-green-100/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-sm backdrop-blur-sm"
                placeholder={mode === 'login' ? 'e.g. Victor' : 'Enter your name or nickname'}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {mode === 'register' && (
                <p className="mt-1.5 text-xs text-green-200/80">
                  This will be your visible name on the scoreboard.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-green-100">
                  Password
                </label>
                <span className="text-xs text-green-300">
                  {mode === 'login' ? '(leave blank if none set)' : '(optional)'}
                </span>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-4 py-3 bg-white/10 border border-white/30 text-white placeholder-green-100/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-sm backdrop-blur-sm"
                placeholder={mode === 'login' ? 'Leave blank if you did not set one' : 'Optional password to protect your picks'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'register' && (
                <p className="mt-1.5 text-xs text-green-200/80">
                  Optional: Leave blank for passwordless access, or set one to secure your picks.
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-600/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-xs sm:text-sm text-center">
                <div className="flex items-center justify-center">
                  <span className="mr-2">⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-600/20 border border-green-500/30 text-green-200 px-4 py-3 rounded-xl text-xs sm:text-sm text-center">
                <div className="flex items-center justify-center">
                  <span className="mr-2">✅</span>
                  <span>{success}</span>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="group relative w-full flex justify-center py-3.5 px-6 text-base font-bold text-black bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl hover:from-yellow-400 hover:to-yellow-500 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-2xl border-2 border-yellow-400/50 disabled:opacity-50 disabled:transform-none"
              >
                <span className="flex items-center">
                  <span className="mr-2 text-xl">🔒</span>
                  {loading
                    ? mode === 'register' ? 'Creating Account...' : 'Signing in...'
                    : mode === 'register' ? 'Create Account & Play' : 'Log In & Play'}
                </span>
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-green-200/70 border-t border-white/10 pt-4">
            {mode === 'login' ? (
              <p>
                Don’t have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-yellow-400 hover:underline font-bold"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already created an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-yellow-400 hover:underline font-bold"
                >
                  Log in here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
