import { isSameTeam } from './teams';

/** A game carrying the moneylines stored for it, as /api/schedule returns them. */
export interface GamePricing {
  homeTeam: string;
  awayTeam: string;
  homeMoneyline?: number | null;
  awayMoneyline?: number | null;
  spread?: string | null;
  total?: number | null;
}

/** The moneyline a pick was taken at, or null when the game was never priced. */
export function moneylineForPick(pickedTeam: string, game?: GamePricing | null): number | null {
  if (!game) return null;
  if (isSameTeam(pickedTeam, game.homeTeam)) return game.homeMoneyline ?? null;
  if (isSameTeam(pickedTeam, game.awayTeam)) return game.awayMoneyline ?? null;
  return null;
}

/** The game a pick was made on: by id, falling back to the matchup. */
export function findGameForPick<T extends GamePricing & { id?: number | null }>(
  pick: { gameId?: number | null; pickedTeam: string },
  games: T[]
): T | undefined {
  return games.find(g => g.id != null && Number(g.id) === Number(pick.gameId))
    ?? games.find(g => isSameTeam(pick.pickedTeam, g.homeTeam) || isSameTeam(pick.pickedTeam, g.awayTeam));
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

export function calculateParlay(moneylines: Array<number | null>): ParlayResult {
  if (moneylines.length === 0) {
    return { multiplier: 1, americanOdds: 'EVEN', impliedProb: 100, payoutOn10: 10, hasAllOdds: true, picksCount: 0 };
  }

  let totalMultiplier = 1;
  let hasAllOdds = true;

  for (const ml of moneylines) {
    if (ml !== null) {
      totalMultiplier *= americanToDecimal(ml);
    } else {
      // Unpriced game: assume a standard favourite so the table still renders.
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
    picksCount: moneylines.length,
  };
}

/** Price a whole ticket against the week's stored lines. */
export function parlayForPicks<T extends GamePricing & { id?: number | null }>(
  picks: Array<{ gameId?: number | null; pickedTeam: string }>,
  games: T[]
): ParlayResult {
  return calculateParlay(picks.map(p => moneylineForPick(p.pickedTeam, findGameForPick(p, games))));
}
