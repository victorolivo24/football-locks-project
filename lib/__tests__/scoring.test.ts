import { describe, it, expect } from 'vitest';
import { scoreLocks, resolveLock } from '../scoring';

const game = (status: string, winnerTeam: string | null) => ({ status, winnerTeam });

describe('scoreLocks', () => {
  it('awards one point per lock when every lock hits', () => {
    expect(scoreLocks([true, true, true])).toBe(3);
    expect(scoreLocks([true])).toBe(1);
  });

  it('does not require picking the whole slate', () => {
    // The bug this replaces: a 3-lock ticket on a 16-game slate scored 0.
    expect(scoreLocks([true, true, true])).toBe(3);
  });

  it('zeroes the week on a single miss, however many locks hit', () => {
    expect(scoreLocks([true, true, false])).toBe(0);
    expect(scoreLocks([false])).toBe(0);
  });

  it('scores nothing for a week with no picks', () => {
    expect(scoreLocks([])).toBe(0);
  });

  it('withholds points while a lock is still unfinished', () => {
    expect(scoreLocks([true, null])).toBe(0);
  });

  it('locks in a zero as soon as one lock misses, even mid-slate', () => {
    // A miss is final: no later result can rescue the week.
    expect(scoreLocks([false, null])).toBe(0);
  });
});

describe('resolveLock', () => {
  const games = new Map<number, { status: string; winnerTeam: string | null }>([
    [1, game('final', 'Detroit Lions')],
    [2, game('in_progress', null)],
    [3, game('final', null)],
  ]);

  it('hits when the picked team won', () => {
    expect(resolveLock({ gameId: 1, pickedTeam: 'Detroit Lions' }, games)).toBe(true);
  });

  it('matches nickname against full team name', () => {
    expect(resolveLock({ gameId: 1, pickedTeam: 'Lions' }, games)).toBe(true);
  });

  it('misses when another team won', () => {
    expect(resolveLock({ gameId: 1, pickedTeam: 'New Orleans Saints' }, games)).toBe(false);
  });

  it('is unresolved while the game is in progress', () => {
    expect(resolveLock({ gameId: 2, pickedTeam: 'Anyone' }, games)).toBe(null);
  });

  it('counts a tie as a miss', () => {
    // League rule: if your team does not win, the lock does not hit.
    expect(resolveLock({ gameId: 3, pickedTeam: 'Anyone' }, games)).toBe(false);
  });

  it('is unresolved when the game is missing', () => {
    expect(resolveLock({ gameId: 999, pickedTeam: 'Anyone' }, games)).toBe(null);
  });
});
