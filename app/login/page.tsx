'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="relative max-w-md w-full space-y-8 px-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-4xl">🔒</span>
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">
              NFL Locks
            </h2>
            <p className="text-green-200 text-lg">
              Enter your name to get started
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-white mb-3">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                autoComplete="name"
                className="relative block w-full px-4 py-3 bg-white/10 border border-white/30 text-white placeholder-green-100/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:z-10 text-sm backdrop-blur-sm"
                placeholder="Victor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="mt-2 text-xs text-green-200">
                New names are registered automatically.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-white mb-3">
                Password <span className="font-normal text-green-200">(optional)</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="relative block w-full px-4 py-3 bg-white/10 border border-white/30 text-white placeholder-green-100/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:z-10 text-sm backdrop-blur-sm"
                placeholder="Leave blank if you did not set one"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-600/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl text-sm text-center">
                <div className="flex items-center justify-center">
                  <span className="mr-2">⚠️</span>
                  {error}
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !name}
                className="group relative w-full flex justify-center py-4 px-6 text-lg font-bold text-black bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl hover:from-yellow-400 hover:to-yellow-500 transform hover:scale-105 transition-all duration-200 shadow-2xl border-2 border-yellow-400/50 disabled:opacity-50 disabled:transform-none"
              >
                <span className="flex items-center">
                  <span className="mr-2 text-2xl">🔒</span>
                  {loading ? 'Signing in...' : 'Start Playing'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div >
  );
}
