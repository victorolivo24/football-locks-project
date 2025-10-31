'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type MotionLevel = 'chill' | 'vibe' | 'hyper';

const MOTION_MAP: Record<MotionLevel, number> = {
  chill: 0.6,
  vibe: 1,
  hyper: 1.45,
};

interface MotionContextValue {
  level: MotionLevel;
  intensity: number;
  setLevel: (next: MotionLevel) => void;
}

const MotionContext = createContext<MotionContextValue | undefined>(undefined);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevel] = useState<MotionLevel>('vibe');
  const intensity = MOTION_MAP[level];

  useEffect(() => {
    const stored = window.localStorage.getItem('motion-level') as MotionLevel | null;
    if (stored && MOTION_MAP[stored]) {
      setLevel(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('motion-level', level);
  }, [level]);

  useEffect(() => {
    document.documentElement.style.setProperty('--intensity', intensity.toString());
  }, [intensity]);

  const value = useMemo<MotionContextValue>(
    () => ({
      level,
      intensity,
      setLevel,
    }),
    [level, intensity]
  );

  return (
    <MotionContext.Provider value={value}>
      <div className="relative min-h-screen">
        {children}
        <AnimatePresence>
          {true && (
            <motion.div
              key="motion-toggle"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="fixed bottom-4 right-4 z-[80] pointer-events-auto"
            >
              <MotionIntensitySlider level={level} onLevelChange={setLevel} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionContext.Provider>
  );
}

export function useMotionLevel() {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error('useMotionLevel must be used within MotionProvider');
  return ctx;
}

interface MotionIntensitySliderProps {
  level: MotionLevel;
  onLevelChange: (next: MotionLevel) => void;
}

const OPTIONS: Array<{ value: MotionLevel; label: string; accent: string }> = [
  { value: 'chill', label: 'Chill', accent: 'from-slate-500 via-slate-600 to-slate-700' },
  { value: 'vibe', label: 'Vibe', accent: 'from-indigo-500 via-purple-500 to-sky-500' },
  { value: 'hyper', label: 'Hyper', accent: 'from-pink-500 via-amber-500 to-lime-400' },
];

function MotionIntensitySlider({ level, onLevelChange }: MotionIntensitySliderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-4 rounded-2xl w-64 shadow-2xl border border-white/10 backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-300">Motion Intensity</span>
        <motion.span
          key={level}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-semibold text-cyan-200"
        >
          {level.toUpperCase()}
        </motion.span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
          const active = option.value === level;
          return (
            <button
              key={option.value}
              onClick={() => onLevelChange(option.value)}
              className={`relative overflow-hidden rounded-xl border text-xs font-semibold uppercase tracking-wide py-2 transition-all ${
                active
                  ? 'border-white/30 text-white shadow-[0_10px_35px_rgba(41,255,166,0.25)]'
                  : 'border-white/10 text-slate-300 hover:text-white hover:border-white/20'
              }`}
              type="button"
            >
              <motion.span
                layoutId="intensity-highlight"
                className={`absolute inset-0 opacity-80 bg-gradient-to-br ${option.accent}`}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                style={{ opacity: active ? 0.9 : 0 }}
              />
              <span className="relative mix-blend-screen">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-400 leading-5">
        Hyper unlocks extra parallax, trails, and glow. Chill tones things down for accessibility.
      </p>
    </motion.div>
  );
}
