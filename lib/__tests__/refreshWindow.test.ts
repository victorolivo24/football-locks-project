import { describe, it, expect } from 'vitest';
import { needsRefresh, KICKOFF_WINDOW_MS } from '../refreshWindow';

const now = Date.UTC(2026, 10, 1, 18, 0, 0); // Sunday 1pm ET
const HOUR = 60 * 60 * 1000;
const game = (offsetMs: number, state: string) => ({ startTime: new Date(now + offsetMs), state });

describe('needsRefresh', () => {
  it('is false with no games', () => {
    expect(needsRefresh([], now)).toBe(false);
  });

  it('is true while any game is live', () => {
    expect(needsRefresh([game(-6 * HOUR, 'post'), game(-1 * HOUR, 'in')], now)).toBe(true);
  });

  it('is true for a game that kicked off within the window, even once ESPN says final', () => {
    expect(needsRefresh([game(-3 * HOUR, 'post')], now)).toBe(true);
    expect(needsRefresh([game(-(KICKOFF_WINDOW_MS - 1), 'post')], now)).toBe(true);
  });

  it('is false once every game is past the window', () => {
    expect(needsRefresh([game(-KICKOFF_WINDOW_MS, 'post'), game(-20 * HOUR, 'post')], now)).toBe(false);
  });

  it('is false for games that have not kicked off', () => {
    expect(needsRefresh([game(10 * 60 * 1000, 'pre'), game(3 * 24 * HOUR, 'pre')], now)).toBe(false);
  });
});
