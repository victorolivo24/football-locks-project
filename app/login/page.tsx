'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const USER_NAMES = ['Victor', 'Mihir', 'Dakota', 'Chris', 'Ryan', 'Jihoo'];

export default function LoginPage() {
  const [name, setName] = useState('');
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
        body: JSON.stringify({ name }),
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
                <span className="text-black font-bold text-4xl">🏈</span>
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">
              NFL Pick'em
            </h2>
            <p className="text-green-200 text-lg">
              Pick your name to get started
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-white mb-3">
                Who are you?
              </label>
              <select
                id="name"
                name="name"
                required
                className="appearance-none relative block w-full px-4 py-3 bg-white/10 border border-white/30 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:z-10 text-sm backdrop-blur-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              >
                <option value="" className="text-gray-900">Select your name</option>
                {USER_NAMES.map((userName) => (
                  <option key={userName} value={userName} className="text-gray-900">
                    {userName}
                  </option>
                ))}
              </select>
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
                  <span className="mr-2 text-2xl">🏈</span>
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
