'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useMotionLevel } from '@/components/motion/MotionProvider';

const USER_NAMES = ['Victor', 'Mihir', 'Dakota', 'Chris', 'Ryan', 'Jihoo'];

export default function LoginPage() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { intensity } = useMotionLevel();

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
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="relative max-w-md w-full space-y-8 px-6"
      >
        <motion.div
          className="absolute inset-0 blur-3xl opacity-70"
          animate={{
            backgroundPosition: ['0% 0%', '200% 200%'],
          }}
          transition={{ duration: 14 / intensity, repeat: Infinity, ease: 'linear' }}
          style={{
            background:
              'conic-gradient(from 140deg, rgba(24,216,255,0.12), transparent, rgba(255,60,172,0.16), transparent)',
          }}
        />
        <motion.div
          whileHover={{ rotateX: 2, rotateY: -3 }}
          className="glass-card p-8 relative z-[2] tilt-hover"
        >
          <div className="text-center relative">
            <motion.div
              className="absolute inset-0 mx-auto w-40 h-40 -top-8 blur-3xl opacity-60 bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-cyan-400/30"
              animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.6, 0.4] }}
              transition={{ duration: 8 / intensity, repeat: Infinity }}
            />
            <div className="flex justify-center mb-6 relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 flex items-center justify-center shadow-xl pulse-ring"
              >
                <span className="text-white font-bold text-4xl">🔒</span>
              </motion.div>
            </div>
            <h2 className="text-4xl font-bold mb-2">
              <span className="bg-gradient-to-r from-indigo-200 via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                NFL Locks
              </span>
            </h2>
            <p className="text-slate-300 text-lg">
              Pick your name to get started
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-200 mb-3">
                Who are you?
              </label>
              <motion.select
                whileFocus={{ scale: 1.01 }}
                id="name"
                name="name"
                required
                className="appearance-none relative block w-full px-4 py-3 bg-white/5 border border-white/15 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:z-10 text-sm backdrop-blur-sm transition-all hover:border-white/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
              >
                <option value="" className="text-gray-900">Select your name</option>
                {USER_NAMES.map((userName) => (
                  <option key={userName} value={userName} className="text-gray-900">
                    {userName}
                  </option>
                ))}
              </motion.select>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/15 border border-rose-500/40 text-rose-100 px-4 py-3 rounded-xl text-sm text-center backdrop-blur-sm"
              >
                <div className="flex items-center justify-center">
                  <span className="mr-2">⚠️</span>
                  {error}
                </div>
              </motion.div>
            )}

            <div>
              <motion.button
                type="submit"
                disabled={loading || !name}
                className="group relative w-full btn-yellow py-4 px-6 rounded-2xl overflow-hidden disabled:opacity-50 disabled:transform-none"
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.97 }}
              >
                <span className="flex items-center">
                  <span className="mr-2 text-2xl">🔒</span>
                  {loading ? 'Signing in...' : 'Start Playing'}
                </span>
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl" />
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </div >
  );
}
