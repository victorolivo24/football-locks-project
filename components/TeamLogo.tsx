"use client";

import Image from 'next/image';
import { useState } from 'react';
import { getEspnLogoUrl, getTeamMeta } from '@/lib/teams';

interface TeamLogoProps {
  team: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizePx: Record<NonNullable<TeamLogoProps['size']>, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

export default function TeamLogo({ team, size = 'md', className = '' }: TeamLogoProps) {
  const meta = getTeamMeta(team);
  const px = sizePx[size];
  const [errored, setErrored] = useState(false);

  const ringColor = meta?.secondary ?? '#ffffff55';
  const bg = meta?.primary ?? '#64748b'; // slate-500 fallback
  const text = meta?.textOnPrimary ?? '#fff';

  const url = !errored ? getEspnLogoUrl(team, 200) : null;

  return (
    <div
      className={`rounded-full flex items-center justify-center shadow-md ring-2 ${className}`}
      style={{
        width: px,
        height: px,
        background: bg,
        color: text,
        boxShadow: `0 6px 16px ${ringColor}55`,
        ringColor,
      } as any}
      title={team}
      aria-label={team}
    >
      {url ? (
        <Image
          src={url}
          alt={`${team} logo`}
          width={Math.floor(px * 0.8)}
          height={Math.floor(px * 0.8)}
          style={{ objectFit: 'contain' }}
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="font-black" style={{ fontSize: px * 0.4 }}>
          {team?.slice(0, 2).toUpperCase() || '?'}
        </span>
      )}
    </div>
  );
}
