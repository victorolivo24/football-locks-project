import { describe, it, expect } from 'vitest';
import { SEASON_2024_FINALS, HISTORICAL_PAR } from '../history';

describe('historical par', () => {
  it('averages the recorded 2024 finals', () => {
    expect(HISTORICAL_PAR).toBeCloseTo(22.3, 1);
  });

  it('sits inside the range those seasons actually covered', () => {
    const totals = Object.values(SEASON_2024_FINALS);
    expect(HISTORICAL_PAR).toBeGreaterThanOrEqual(Math.min(...totals));
    expect(HISTORICAL_PAR).toBeLessThanOrEqual(Math.max(...totals));
  });
});
