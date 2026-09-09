import { describe, it, expect } from 'vitest';
import { isLineSettled } from '../espnOdds';

const at = (iso: string) => new Date(iso).getTime();
const NOW = at('2026-09-13T18:00:00Z');

describe('isLineSettled', () => {
  it('leaves an upcoming game open to refresh', () => {
    expect(isLineSettled('2026-09-13T20:25:00Z', NOW)).toBe(false);
  });

  it('freezes a game that has kicked off', () => {
    // The daily pull must not overwrite this with in-play numbers.
    expect(isLineSettled('2026-09-13T17:00:00Z', NOW)).toBe(true);
  });

  it('freezes exactly at kickoff', () => {
    expect(isLineSettled('2026-09-13T18:00:00Z', NOW)).toBe(true);
  });

  it('treats a long-finished game as settled', () => {
    expect(isLineSettled('2025-09-07T17:00:00Z', NOW)).toBe(true);
  });

  it('accepts a Date as readily as a string', () => {
    expect(isLineSettled(new Date('2026-09-13T17:00:00Z'), NOW)).toBe(true);
  });

  it('does not freeze on a missing or unparseable kickoff', () => {
    // Better to refresh a game we cannot place than to strand its line.
    expect(isLineSettled(null, NOW)).toBe(false);
    expect(isLineSettled(undefined, NOW)).toBe(false);
    expect(isLineSettled('not a date', NOW)).toBe(false);
  });
});
