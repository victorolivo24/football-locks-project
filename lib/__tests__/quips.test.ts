import { describe, it, expect } from 'vitest';
import { bustQuip, hitQuip, ownQuip, QuipContext } from '../quips';

const ctx = (over: Partial<QuipContext> = {}): QuipContext => ({
  who: 'David',
  plural: false,
  team: 'Bills',
  margin: 10,
  earlyWeek: false,
  seed: 'seed-1',
  ...over,
});

describe('bustQuip', () => {
  it('is stable for the same event', () => {
    // A result picked up by two refreshes must not arrive worded two ways.
    expect(bustQuip(ctx())).toBe(bustQuip(ctx()));
  });

  it('varies across different events', () => {
    const lines = Array.from({ length: 40 }, (_, i) => bustQuip(ctx({ seed: `game-${i}` })));
    const distinct = lines.filter((l, i) => lines.indexOf(l) === i);
    expect(distinct.length).toBeGreaterThan(8);
  });

  it('always names who it happened to', () => {
    for (let i = 0; i < 40; i++) {
      expect(bustQuip(ctx({ seed: `s${i}` }))).toContain('David');
    }
  });

  it('can reach a team joke for the team they backed', () => {
    const lines = Array.from({ length: 60 }, (_, i) => bustQuip(ctx({ team: 'Ravens', seed: `r${i}` })));
    expect(lines.some(l => l.includes('nevermore'))).toBe(true);
  });

  it('can reach an early-week line on a Thursday', () => {
    const lines = Array.from({ length: 60 }, (_, i) => bustQuip(ctx({ earlyWeek: true, seed: `t${i}` })));
    expect(lines.some(l => /Thursday|weekend|started|speedran|casualty/.test(l))).toBe(true);
  });

  it('never offers an early-week line on a Sunday', () => {
    for (let i = 0; i < 60; i++) {
      expect(bustQuip(ctx({ earlyWeek: false, seed: `u${i}` }))).not.toContain('still Thursday');
    }
  });

  it('reaches blowout lines only when it was a blowout', () => {
    const blowout = Array.from({ length: 60 }, (_, i) => bustQuip(ctx({ margin: 28, seed: `b${i}` })));
    expect(blowout.some(l => /fourth quarter|halftime|wasn't close/.test(l))).toBe(true);

    for (let i = 0; i < 60; i++) {
      expect(bustQuip(ctx({ margin: 10, seed: `c${i}` }))).not.toContain('by halftime');
    }
  });

  it('reaches a one-score line only on a one-score game', () => {
    const close = Array.from({ length: 60 }, (_, i) => bustQuip(ctx({ margin: 3, seed: `n${i}` })));
    expect(close.some(l => /sting|So close|missed kick|One score/.test(l))).toBe(true);
  });

  it('agrees with itself grammatically for a pair', () => {
    const lines = Array.from({ length: 40 }, (_, i) =>
      bustQuip(ctx({ who: 'Ryan and Chris', plural: true, seed: `p${i}` }))
    );
    expect(lines.some(l => l.includes('have left the building'))).toBe(true);
    expect(lines.every(l => !l.includes('has left the building'))).toBe(true);
  });

  it('survives a team it has no joke for', () => {
    expect(bustQuip(ctx({ team: 'Sharks' }))).toBeTruthy();
  });

  it('handles a one point loss without saying "1 points"', () => {
    const lines = Array.from({ length: 60 }, (_, i) => bustQuip(ctx({ margin: 1, seed: `o${i}` })));
    expect(lines.every(l => !l.includes('1 points'))).toBe(true);
  });
});

describe('hitQuip', () => {
  it('names the survivor and stays stable', () => {
    expect(hitQuip(ctx())).toContain('David');
    expect(hitQuip(ctx())).toBe(hitQuip(ctx()));
  });

  it('agrees grammatically for a pair', () => {
    const lines = Array.from({ length: 40 }, (_, i) =>
      hitQuip(ctx({ who: 'Ryan and Chris', plural: true, seed: `h${i}` }))
    );
    expect(lines.every(l => !l.includes('is still breathing'))).toBe(true);
  });
});

describe('ownQuip', () => {
  it('speaks to the player rather than about them', () => {
    const loss = ownQuip(ctx({ who: 'you' }), false);
    expect(loss).not.toContain('David');
  });

  it('differs between a hit and a loss', () => {
    expect(ownQuip(ctx(), true)).not.toBe(ownQuip(ctx(), false));
  });
});
