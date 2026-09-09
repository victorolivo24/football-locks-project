import { describe, it, expect } from 'vitest';
import { pickKey, similarity, sharedCount } from '../overlap';

const set = (...keys: string[]) => new Set(keys);

describe('pickKey', () => {
  it('identifies a pick by game and side', () => {
    expect(pickKey({ gameId: 12, pickedTeam: 'Detroit Lions' })).toBe('12:detroit lions');
  });

  it('ignores case and padding so stored variants still match', () => {
    expect(pickKey({ gameId: 12, pickedTeam: '  detroit lions ' }))
      .toBe(pickKey({ gameId: 12, pickedTeam: 'Detroit Lions' }));
  });

  it('separates opposite sides of the same game', () => {
    expect(pickKey({ gameId: 12, pickedTeam: 'Lions' }))
      .not.toBe(pickKey({ gameId: 12, pickedTeam: 'Saints' }));
  });
});

describe('similarity', () => {
  it('is 1 for identical tickets', () => {
    expect(similarity(set('a', 'b', 'c'), set('a', 'b', 'c'))).toBe(1);
  });

  it('is 0 when nothing is shared', () => {
    expect(similarity(set('a', 'b'), set('c', 'd'))).toBe(0);
  });

  it('scores partial overlap against the combined pool', () => {
    // 2 shared of 4 distinct
    expect(similarity(set('a', 'b', 'c'), set('a', 'b'))).toBeCloseTo(2 / 3, 5);
  });

  it('rewards a tight pair over one that shares the same count across more picks', () => {
    const tight = similarity(set('a', 'b', 'c'), set('a', 'b', 'c'));
    const loose = similarity(set('a', 'b', 'c', 'd', 'e'), set('a', 'b', 'c', 'x', 'y'));
    expect(tight).toBeGreaterThan(loose);
  });

  it('is 0 when either player sat the week out', () => {
    expect(similarity(set(), set('a'))).toBe(0);
  });
});

describe('sharedCount', () => {
  it('counts identical picks', () => {
    expect(sharedCount(set('a', 'b', 'c'), set('a', 'b'))).toBe(2);
    expect(sharedCount(set('a'), set('b'))).toBe(0);
  });
});
