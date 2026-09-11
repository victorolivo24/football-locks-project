import { describe, it, expect } from 'vitest';
import { bustQuip, bustPools, hitQuip, ownQuip, QuipContext } from '../quips';

const ctx = (over: Partial<QuipContext> = {}): QuipContext => ({
  who: 'David',
  plural: false,
  team: 'Bills',
  margin: 10,
  earlyWeek: false,
  lockCount: 3,
  survivors: 2,
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

  it('mostly names who it happened to, the non-sequiturs aside', () => {
    // Absurd lines deliberately carry no name; the body always does.
    const lines = Array.from({ length: 60 }, (_, i) => bustQuip(ctx({ seed: `s${i}` })));
    const named = lines.filter(l => l.includes('David')).length;
    expect(named).toBeGreaterThan(lines.length / 2);
  });

  it('offers a team joke for the team they backed', () => {
    const lines = bustPools(ctx({ team: 'Ravens' })).flatMap(pool => pool.lines);
    expect(lines.some(l => l.includes('nevermore'))).toBe(true);
  });

  it('weights the team joke so it is not buried under the filler', () => {
    const pools = bustPools(ctx({ team: 'Ravens' }));
    const teamPool = pools.find(p => p.lines.some(l => l.includes('nevermore')));
    const total = pools.reduce((sum, p) => sum + p.weight, 0);
    expect(teamPool!.weight / total).toBeGreaterThan(0.1);
  });

  it('offers an early-week line on a Thursday', () => {
    const lines = bustPools(ctx({ earlyWeek: true })).flatMap(pool => pool.lines);
    expect(lines.some(l => /Thursday|weekend|started|speedran|casualty/.test(l))).toBe(true);
  });

  it('never offers an early-week line on a Sunday', () => {
    for (let i = 0; i < 60; i++) {
      expect(bustQuip(ctx({ earlyWeek: false, seed: `u${i}` }))).not.toContain('still Thursday');
    }
  });

  it('reaches blowout lines only when it was a blowout', () => {
    const blowout = bustPools(ctx({ margin: 28 })).flatMap(p => p.lines);
    expect(blowout.some(l => /fourth quarter|halftime|wasn't close/.test(l))).toBe(true);

    for (let i = 0; i < 60; i++) {
      expect(bustQuip(ctx({ margin: 10, seed: `c${i}` }))).not.toContain('by halftime');
    }
  });

  it('reaches a one-score line only on a one-score game', () => {
    const close = bustPools(ctx({ margin: 3 })).flatMap(p => p.lines);
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

describe('absurd and narrative lines', () => {
  const sample = (over: Partial<QuipContext>) =>
    bustPools(ctx(over)).flatMap(pool => pool.lines);

  it('reaches the non-sequiturs', () => {
    const lines = sample({});
    expect(lines.some(l => /chicken|honey|shovel|Home Depot|goose|ostrich/.test(l))).toBe(true);
  });

  it('keeps non-sequiturs free of names, so the body does the explaining', () => {
    const absurd = sample({}).filter(l => /chicken lays eggs|Home Depot|Who taught you/.test(l));
    expect(absurd.length).toBeGreaterThan(0);
    expect(absurd.every(l => !l.includes('David'))).toBe(true);
  });

  it('tells the story of a single lock going down', () => {
    const lines = sample({ lockCount: 1 });
    expect(lines.some(l => /exactly one lock|played it safe with one pick/.test(l))).toBe(true);
  });

  it('calls out a big stack that died early', () => {
    const lines = sample({ lockCount: 6 });
    expect(lines.some(l => l.includes('stacked 6 locks'))).toBe(true);
  });

  it('never claims a stack when they only had one', () => {
    const lines = sample({ lockCount: 1 });
    expect(lines.every(l => !l.includes('stacked'))).toBe(true);
  });

  it('counts who is left', () => {
    const lines = sample({ survivors: 3 });
    expect(lines.some(l => l.includes('3 still alive'))).toBe(true);
  });

  it('marks the last player standing', () => {
    const lines = sample({ survivors: 1 });
    expect(lines.some(l => l.includes('One player left standing'))).toBe(true);
  });

  it('handles a total wipeout', () => {
    const lines = sample({ survivors: 0 });
    expect(lines.some(l => l.includes('Nobody survived'))).toBe(true);
  });

  it('keeps narrative lines away from group busts, which have no single count', () => {
    const lines = sample({ who: 'Ryan and Chris', plural: true, lockCount: 4 });
    expect(lines.every(l => !l.includes('on the ticket'))).toBe(true);
    expect(lines.every(l => !l.includes('stacked'))).toBe(true);
  });

  it('still works when nothing contextual is known', () => {
    const lines = sample({ lockCount: null, survivors: null, margin: null });
    expect(lines.every(l => l.length > 0)).toBe(true);
    expect(lines.every(l => !l.includes('null'))).toBe(true);
  });
});
