"use client";

import Image from 'next/image';
import { useState } from 'react';
import { getEspnLogoUrl, getTeamMeta, normalizeTeam } from '@/lib/teams';

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
  const meta = getTeamMeta(normalizeTeam(team));
  const px = sizePx[size];
  const [errored, setErrored] = useState(false);

  const url = !errored ? getEspnLogoUrl(team, 500) : null;

  // Show the mark itself. The team colours are only used for the fallback
  // badge, so a logo is never sitting on a clashing block of its own palette.
  if (url) {
    return (
      <Image
        src={url}
        alt={`${team} logo`}
        width={px}
        height={px}
        className={className}
        style={{ width: px, height: px, objectFit: 'contain' }}
        onError={() => setErrored(true)}
        title={team}
        unoptimized
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center shadow-md ${className}`}
      style={{
        width: px,
        height: px,
        background: meta?.primary ?? '#64748b',
        color: meta?.textOnPrimary ?? '#fff',
      }}
      title={team}
      aria-label={team}
    >
      <span className="font-black" style={{ fontSize: px * 0.4 }}>
        {meta ? meta.abbr.toUpperCase() : (team?.slice(0, 2).toUpperCase() || '?')}
      </span>
    </div>
  );
}
