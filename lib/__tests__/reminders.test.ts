import { describe, it, expect } from 'vitest';
import { reminderDue, REMINDER_WINDOW_HOURS } from '../reminders';

describe('reminderDue', () => {
  it('nudges the day before kickoff', () => {
    expect(reminderDue(24)).toBe(true);
  });

  it('nudges a few hours out', () => {
    expect(reminderDue(3)).toBe(true);
  });

  it('stays quiet once the slate has started', () => {
    // Past kickoff it is a postmortem, not a reminder.
    expect(reminderDue(0)).toBe(false);
    expect(reminderDue(-2)).toBe(false);
  });

  it('stays quiet early in the week', () => {
    expect(reminderDue(REMINDER_WINDOW_HOURS + 1)).toBe(false);
    expect(reminderDue(120)).toBe(false);
  });

  it('covers a Wednesday opener from the day before', () => {
    // Week 1 of 2026 kicks off Wednesday, so a Thursday-shaped rule would
    // never have fired. A daily 5pm run sits ~27 hours out here.
    expect(reminderDue(27)).toBe(true);
  });
});
