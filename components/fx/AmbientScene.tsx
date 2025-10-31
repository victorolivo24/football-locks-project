'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { useMotionLevel } from '@/components/motion/MotionProvider';

const ORB_CONFIG = [
  { size: 420, hue: 'rgba(157,123,255,0.32)', duration: 28 },
  { size: 360, hue: 'rgba(24,216,255,0.28)', duration: 24 },
  { size: 540, hue: 'rgba(41,255,166,0.22)', duration: 34 },
];

function Orbs() {
  const { intensity } = useMotionLevel();
  const configs = useMemo(() => ORB_CONFIG, []);

  return (
    <>
      {configs.map((orb, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full blur-3xl mix-blend-screen"
          style={{
            width: orb.size,
            height: orb.size,
            background: orb.hue,
          }}
          animate={{
            x: [
              (index % 2 === 0 ? -1 : 1) * 40 * intensity,
              (index % 2 === 0 ? 1 : -1) * 30 * intensity,
            ],
            y: [
              (index % 3 === 0 ? 1 : -1) * 30 * intensity,
              (index % 3 === 0 ? -1 : 1) * 35 * intensity,
            ],
            scale: [1, 1.08 + intensity * 0.04, 1],
          }}
          transition={{
            duration: orb.duration / intensity,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
}

function CursorGlow() {
  const { intensity } = useMotionLevel();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isMounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handler = (event: PointerEvent) => {
      const { clientX, clientY } = event;
      x.set(clientX);
      y.set(clientY);
    };
    window.addEventListener('pointermove', handler);
    return () => {
      window.removeEventListener('pointermove', handler);
    };
  }, [x, y]);

  const light = useMotionTemplate`radial-gradient(450px circle at ${x}px ${y}px, rgba(157,123,255,${0.24 *
    intensity}), rgba(24,216,255,0.05), transparent 70%)`;

  if (!isMounted) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5]"
      style={{
        background: light,
        filter: 'blur(0.5px)',
        mixBlendMode: 'screen',
      }}
    />
  );
}

function Grid() {
  const { intensity } = useMotionLevel();
  return (
    <motion.div
      className="absolute inset-[-10%] z-0 opacity-30"
      animate={{ backgroundPosition: ['0px 0px', `${60 * intensity}px ${40 * intensity}px`] }}
      transition={{ duration: 18 / intensity, repeat: Infinity, ease: 'linear' }}
      style={{
        backgroundImage:
          'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }}
    />
  );
}

export const AmbientScene = memo(function AmbientScene() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[2] overflow-hidden">
        <Grid />
        <motion.div
          className="absolute inset-0 floating-slow"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, rgba(255,60,172,0.12), transparent 50%), radial-gradient(circle at 80% 65%, rgba(24,216,255,0.12), transparent 50%)',
            mixBlendMode: 'screen',
          }}
        />
        <div className="absolute -top-40 left-[-10%] floating">
          <Orbs />
        </div>
      </div>
      <CursorGlow />
    </>
  );
});
