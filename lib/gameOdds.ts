import { isSameTeam, normalizeTeam } from './teams';

export interface GameOdds {
  awayTeam: string;
  homeTeam: string;
  awayMoneyline: number; // e.g. +150
  homeMoneyline: number; // e.g. -180
  spread?: string; // e.g. "SEA -3.5"
  total?: number; // e.g. 45.5
}

// Week 1 Odds provided by user
export const WEEK_1_ODDS: GameOdds[] = [
  { awayTeam: 'Patriots', homeTeam: 'Seahawks', awayMoneyline: 150, homeMoneyline: -180, spread: 'SEA -3.5', total: 45.5 },
  { awayTeam: '49ers', homeTeam: 'Rams', awayMoneyline: 154, homeMoneyline: -185, spread: 'LAR -3.5', total: 48.5 },
  { awayTeam: 'Buccaneers', homeTeam: 'Bengals', awayMoneyline: 164, homeMoneyline: -198, spread: 'CIN -3.5', total: 51.5 },
  { awayTeam: 'Saints', homeTeam: 'Lions', awayMoneyline: 235, homeMoneyline: -290, spread: 'DET -6.5', total: 48.5 },
  { awayTeam: 'Jets', homeTeam: 'Titans', awayMoneyline: 105, homeMoneyline: -125, spread: 'TEN -1.5', total: 39.5 },
  { awayTeam: 'Ravens', homeTeam: 'Colts', awayMoneyline: -162, homeMoneyline: 136, spread: 'BAL -3.5', total: 48.5 },
  { awayTeam: 'Falcons', homeTeam: 'Steelers', awayMoneyline: 154, homeMoneyline: -185, spread: 'PIT -3.5', total: 42.5 },
  { awayTeam: 'Bears', homeTeam: 'Panthers', awayMoneyline: -148, homeMoneyline: 124, spread: 'CHI -3.5', total: 45.5 },
  { awayTeam: 'Browns', homeTeam: 'Jaguars', awayMoneyline: 300, homeMoneyline: -380, spread: 'JAX -8.5', total: 39.5 },
  { awayTeam: 'Bills', homeTeam: 'Texans', awayMoneyline: -102, homeMoneyline: -118, spread: 'BUF -1.5', total: 45.5 },
  { awayTeam: 'Dolphins', homeTeam: 'Raiders', awayMoneyline: 154, homeMoneyline: -185, spread: 'LV -3.5', total: 39.5 },
  { awayTeam: 'Packers', homeTeam: 'Vikings', awayMoneyline: 102, homeMoneyline: -122, spread: 'MIN -1.5', total: 45.5 },
  { awayTeam: 'Commanders', homeTeam: 'Eagles', awayMoneyline: 170, homeMoneyline: -205, spread: 'PHI -4.5', total: 46.5 },
  { awayTeam: 'Cardinals', homeTeam: 'Chargers', awayMoneyline: 455, homeMoneyline: -625, spread: 'LAC -9.5', total: 48.5 },
  { awayTeam: 'Cowboys', homeTeam: 'Giants', awayMoneyline: -155, homeMoneyline: 130, spread: 'DAL -2.5', total: 48.5 },
  { awayTeam: 'Broncos', homeTeam: 'Chiefs', awayMoneyline: 130, homeMoneyline: -155, spread: 'KC -2.5', total: 42.5 },
];

export function getOddsForGame(awayTeam: string, homeTeam: string, season = 2026, week = 1): GameOdds | undefined {
  if (week === 1) {
    return WEEK_1_ODDS.find(
      (o) =>
        (isSameTeam(o.awayTeam, awayTeam) && isSameTeam(o.homeTeam, homeTeam)) ||
        (isSameTeam(o.awayTeam, homeTeam) && isSameTeam(o.homeTeam, awayTeam))
    );
  }
  return undefined;
}

export function getTeamMoneyline(pickedTeam: string, awayTeam: string, homeTeam: string, season = 2026, week = 1): number | null {
  const game = getOddsForGame(awayTeam, homeTeam, season, week);
  if (!game) return null;

  if (isSameTeam(pickedTeam, game.homeTeam)) {
    return game.homeMoneyline;
  }
  if (isSameTeam(pickedTeam, game.awayTeam)) {
    return game.awayMoneyline;
  }
  return null;
}

export function americanToDecimal(american: number): number {
  if (american > 0) {
    return 1 + american / 100;
  }
  return 1 + 100 / Math.abs(american);
}

export function decimalToAmerican(decimal: number): string {
  if (decimal >= 2.0) {
    const us = Math.round((decimal - 1) * 100);
    return `+${us}`;
  }
  const us = Math.round(100 / (decimal - 1));
  return `-${us}`;
}

export interface ParlayResult {
  multiplier: number; // e.g. 7.29
  americanOdds: string; // e.g. "+630"
  impliedProb: number; // e.g. 13.7 (%)
  payoutOn10: number; // e.g. 72.95
  hasAllOdds: boolean;
  picksCount: number;
}

export function calculateParlay(
  picks: Array<{ pickedTeam: string; homeTeam?: string; awayTeam?: string }>,
  season = 2026,
  week = 1
): ParlayResult {
  if (picks.length === 0) {
    return { multiplier: 1, americanOdds: 'EVEN', impliedProb: 100, payoutOn10: 10, hasAllOdds: true, picksCount: 0 };
  }

  let totalMultiplier = 1;
  let hasAllOdds = true;

  for (const pick of picks) {
    const ml = (pick.homeTeam && pick.awayTeam)
      ? getTeamMoneyline(pick.pickedTeam, pick.awayTeam, pick.homeTeam, season, week)
      : null;

    if (ml !== null) {
      totalMultiplier *= americanToDecimal(ml);
    } else {
      // If odds not found for this game, default to standard -150 favorite
      totalMultiplier *= americanToDecimal(-150);
      hasAllOdds = false;
    }
  }

  const roundedMultiplier = Number(totalMultiplier.toFixed(2));
  const americanOdds = decimalToAmerican(totalMultiplier);
  const impliedProb = Number(((1 / totalMultiplier) * 100).toFixed(1));
  const payoutOn10 = Number((10 * totalMultiplier).toFixed(2));

  return {
    multiplier: roundedMultiplier,
    americanOdds,
    impliedProb,
    payoutOn10,
    hasAllOdds,
    picksCount: picks.length,
  };
}
