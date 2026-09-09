import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { resolveWeekFromKickoffs } from '../nfl';

const et = (iso: string) => DateTime.fromISO(iso, { zone: 'America/New_York' });

// Real opening kickoffs from the seeded 2026 schedule: week 1 opens on a
// Wednesday, which is exactly the case the old date math got wrong.
const kickoffs = new Map<number, Date>([
  [1, et('2026-09-09T20:20').toJSDate()],
  [2, et('2026-09-17T20:15').toJSDate()],
  [3, et('2026-09-24T20:15').toJSDate()],
]);

describe('resolveWeekFromKickoffs', () => {
  it('reads week 1 on opening night, not week 2', () => {
    expect(resolveWeekFromKickoffs(kickoffs, et('2026-09-09T18:00'))?.week).toBe(1);
  });

  it('stays on week 1 through its Sunday and Monday games', () => {
    expect(resolveWeekFromKickoffs(kickoffs, et('2026-09-13T13:00'))?.week).toBe(1);
    expect(resolveWeekFromKickoffs(kickoffs, et('2026-09-14T23:00'))?.week).toBe(1);
  });

  it('rolls to week 2 when the next week opens Tuesday morning', () => {
    expect(resolveWeekFromKickoffs(kickoffs, et('2026-09-15T06:59'))?.week).toBe(1);
    expect(resolveWeekFromKickoffs(kickoffs, et('2026-09-15T07:00'))?.week).toBe(2);
  });

  it('clamps to the first week before the season opens', () => {
    expect(resolveWeekFromKickoffs(kickoffs, et('2026-08-01T12:00'))?.week).toBe(1);
  });

  it('stays on the final scheduled week after it ends', () => {
    expect(resolveWeekFromKickoffs(kickoffs, et('2026-12-01T12:00'))?.week).toBe(3);
  });

  it('returns null with no schedule to read', () => {
    expect(resolveWeekFromKickoffs(new Map(), et('2026-09-09T18:00'))).toBe(null);
  });
});
