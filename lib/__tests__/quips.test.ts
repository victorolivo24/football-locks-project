import { describe, it, expect } from 'vitest';
import { bustQuip, bustPools, hitQuip, hitPools, ownQuip, startQuip, reminderQuip, QuipContext } from '../quips';

const ctx = (over: Partial<QuipContext> = {}): QuipContext => ({
  who: 'David',
  plural: false,
  team: 'Bills',
  margin: 10,
  earlyWeek: false,
  lockCount: 3,
  survivors: 2,
  locksHit: 1,
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
    const lines = bustPools(ctx({ who: 'Ryan and Chris', plural: true })).flatMap(p => p.lines);
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
  it('stays stable for the same event', () => {
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

describe('hit lines versus bust lines', () => {
  it('keeps line-was-right jokes off busts', () => {
    // This league backs favorites, so a bust means the favorite LOST.
    // "The line knew" would be factually backwards there.
    const busts = bustPools(ctx()).flatMap(p => p.lines);
    expect(busts.every(l => !l.includes('The line knew'))).toBe(true);
    expect(busts.every(l => !l.includes('was favored for a reason'))).toBe(true);
    expect(busts.every(l => !l.includes('Math was right there'))).toBe(true);
  });

  it('puts them on hits instead', () => {
    const hits = Array.from({ length: 60 }, (_, i) => hitQuip(ctx({ seed: `hq${i}` })));
    expect(hits.some(l => /The line knew|favored for a reason|Math was right there/.test(l))).toBe(true);
  });

  it('still names the survivor most of the time', () => {
    const hits = Array.from({ length: 60 }, (_, i) => hitQuip(ctx({ seed: `hn${i}` })));
    expect(hits.filter(l => l.includes('David')).length).toBeGreaterThan(hits.length / 2);
  });
});

describe('hit lines with context', () => {
  const hitLines = (over: Partial<QuipContext>) =>
    hitPools(ctx(over)).flatMap(pool => pool.lines);

  it('counts down how many locks are left', () => {
    const lines = hitLines({ who: 'Mihir', lockCount: 4, locksHit: 3 });
    expect(lines).toContain('3 down, 1 to go for Mihir');
    expect(lines).toContain('Mihir needs one more');
  });

  it('calls a completed ticket done', () => {
    const lines = hitLines({ who: 'Mihir', lockCount: 3, locksHit: 3 });
    expect(lines.some(l => l.includes('Full ticket, cashed'))).toBe(true);
    expect(lines.every(l => !l.includes('to go for'))).toBe(true);
  });

  it('does not say "one more" when several remain', () => {
    const lines = hitLines({ who: 'Ryan', lockCount: 5, locksHit: 1 });
    expect(lines.every(l => !l.includes('needs one more'))).toBe(true);
  });

  it('gives Jihoo his own material', () => {
    const lines = hitLines({ who: 'Jihoo' });
    expect(lines.some(l => l.includes('Unc still got it'))).toBe(true);
    expect(lines.some(l => l.includes('Reigning champ'))).toBe(true);
  });

  it('gives Chris his', () => {
    const lines = hitLines({ who: 'Chris' });
    expect(lines.some(l => l.includes('mirror'))).toBe(true);
  });

  it('weights a personal joke above the generic pools', () => {
    const pools = hitPools(ctx({ who: 'Jihoo' }));
    const personal = pools.find(p => p.lines.some(l => l.includes('Unc still got it')))!;
    const generic = pools.find(p => p.lines.some(l => l.includes('survives')))!;
    expect(personal.weight).toBeGreaterThan(generic.weight);
  });

  it('keeps personal jokes off other players', () => {
    const lines = hitLines({ who: 'Ryan' });
    expect(lines.every(l => !l.includes('Unc'))).toBe(true);
    expect(lines.every(l => !l.includes('mirror'))).toBe(true);
  });

  it('keeps personal jokes off a pair, where they make no sense', () => {
    const lines = hitLines({ who: 'Jihoo and Chris', plural: true });
    expect(lines.every(l => !l.includes('Unc'))).toBe(true);
    expect(lines.every(l => !l.includes('to go for'))).toBe(true);
  });

  it('falls back cleanly when no counts are known', () => {
    const lines = hitLines({ lockCount: null, locksHit: null });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every(l => !l.includes('null'))).toBe(true);
  });
});

describe('player-specific bust lines', () => {
  const bustLines = (over: Partial<QuipContext>) =>
    bustPools(ctx(over)).flatMap(pool => pool.lines);

  it('asks how long Dakota is sticking around', () => {
    const lines = bustLines({ who: 'Dakota' });
    expect(lines.some(l => l.includes('until Dakota gives up'))).toBe(true);
  });

  it('treats David as the new guy', () => {
    const lines = bustLines({ who: 'David' });
    expect(lines.some(l => l.includes('Welcome to the league'))).toBe(true);
  });

  it('finds the jokes through a stored surname', () => {
    // Users are stored as "Dakota Racine"; keying on the full name would
    // silently disable his material.
    const lines = bustLines({ who: 'Dakota Racine' });
    expect(lines.some(l => l.includes('Dakota gives up'))).toBe(true);
  });

  it('keeps a player\'s jokes off everyone else', () => {
    const lines = bustLines({ who: 'Ryan' });
    expect(lines.every(l => !l.includes('gives up'))).toBe(true);
    expect(lines.every(l => !l.includes('Welcome to the league'))).toBe(true);
  });

  it('keeps them off group busts', () => {
    const lines = bustLines({ who: 'Dakota and David', plural: true });
    expect(lines.every(l => !l.includes('gives up'))).toBe(true);
    expect(lines.every(l => !l.includes('Rookie mistake'))).toBe(true);
  });

  it('does not reuse a hit joke on a bust', () => {
    // "Luckily Dakota remembered to submit" makes no sense attached to a loss.
    const lines = bustLines({ who: 'Dakota' });
    expect(lines.every(l => !l.includes('remembered to submit'))).toBe(true);
  });

  it('gives Dakota the right joke on a hit', () => {
    const lines = hitPools(ctx({ who: 'Dakota Racine' })).flatMap(p => p.lines);
    expect(lines.some(l => l.includes('remembered to submit'))).toBe(true);
  });

  it("gives David beginner's luck on a hit", () => {
    const lines = hitPools(ctx({ who: 'David' })).flatMap(p => p.lines);
    expect(lines.some(l => l.includes("Beginner's luck"))).toBe(true);
  });
});

describe('group, start and reminder lines', () => {
  it('has material for a group that cashed together', () => {
    const lines = hitPools(ctx({ who: 'Chris and Victor', plural: true })).flatMap(p => p.lines);
    expect(lines.some(l => l.includes('made the same pick and it worked'))).toBe(true);
    expect(lines.some(l => l.includes('indistinguishable'))).toBe(true);
  });

  it('has material for a group that died together', () => {
    const lines = bustPools(ctx({ who: 'Chris and Victor', plural: true })).flatMap(p => p.lines);
    expect(lines.some(l => l.includes('go down together'))).toBe(true);
    expect(lines.some(l => l.includes('copying each other'))).toBe(true);
  });

  it('weights group lines above the generic pools', () => {
    const pools = hitPools(ctx({ who: 'Chris and Victor', plural: true }));
    const group = pools.find(p => p.lines.some(l => l.includes('all cashed that one')))!;
    const generic = pools.find(p => p.lines.some(l => l.includes('survives')))!;
    expect(group.weight).toBeGreaterThan(generic.weight);
  });

  it('keeps group lines away from a single player', () => {
    const lines = bustPools(ctx({ who: 'Ryan' })).flatMap(p => p.lines);
    expect(lines.every(l => !l.includes('go down together'))).toBe(true);
  });

  it('varies the kickoff line', () => {
    const lines = Array.from({ length: 40 }, (_, i) => startQuip(ctx({ seed: `k${i}` })));
    const distinct = lines.filter((l, i) => lines.indexOf(l) === i);
    expect(distinct.length).toBeGreaterThan(4);
  });

  it('speaks to the player at kickoff rather than about them', () => {
    const lines = Array.from({ length: 40 }, (_, i) => startQuip(ctx({ who: 'you', seed: `k${i}` })));
    expect(lines.every(l => !l.includes('David'))).toBe(true);
  });

  it('varies the reminder', () => {
    const lines = Array.from({ length: 40 }, (_, i) => reminderQuip(`r${i}`));
    const distinct = lines.filter((l, i) => lines.indexOf(l) === i);
    expect(distinct.length).toBeGreaterThan(4);
  });

  it('is stable per reminder, so a repeat run reads the same', () => {
    expect(reminderQuip('same')).toBe(reminderQuip('same'));
  });
});
