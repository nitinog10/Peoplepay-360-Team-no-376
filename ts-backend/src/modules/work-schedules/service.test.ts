/**
 * Working-schedule rules: which days are worked, hours per day, weekly hours and
 * the presenter every schedule response goes through. Weekly hours is derived —
 * `|daysOfWeek| × (endTime − startTime)` — never an input, so the arithmetic and
 * the malformed-input path are both pinned here. No database in the loop:
 * `presentSchedule` is pure over a row object.
 */
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client';
import type { WorkSchedule } from '../../generated/prisma/client';
import { parseDateOnly, parseTime } from '../../lib/dates';
import { countWorkingDays, dailyHours, isWorkingDay, scheduleDays, weeklyHours } from './resolve';
import { presentSchedule } from './service';

/** A Mon–Fri 09:00–18:00 schedule: 9 h/day, 45 h/week. */
function schedule(overrides: Partial<WorkSchedule> = {}): WorkSchedule {
  return {
    scheduleId: 1,
    scheduleName: 'Standard 9-6',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: parseTime('09:00'),
    endTime: parseTime('18:00'),
    weeklyHours: new Prisma.Decimal('45.00'),
    description: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('dailyHours', () => {
  it('is the span between start and end', () => {
    expect(dailyHours(schedule())).toBe(9);
    expect(dailyHours(schedule({ startTime: parseTime('09:30'), endTime: parseTime('14:00') }))).toBe(4.5);
    expect(dailyHours(schedule({ startTime: parseTime('22:00'), endTime: parseTime('23:45') }))).toBe(1.75);
  });

  it('goes non-positive when end is not after start (the 400 the service raises)', () => {
    expect(dailyHours(schedule({ startTime: parseTime('18:00'), endTime: parseTime('09:00') }))).toBe(-9);
    expect(dailyHours(schedule({ startTime: parseTime('09:00'), endTime: parseTime('09:00') }))).toBe(0);
  });
});

describe('weeklyHours', () => {
  it('multiplies working days by the daily span', () => {
    expect(weeklyHours(schedule())).toBe(45);
    expect(weeklyHours(schedule({ daysOfWeek: [1, 2, 3, 4, 5, 6] }))).toBe(54);
    expect(weeklyHours(schedule({ daysOfWeek: [1, 3, 5], endTime: parseTime('13:30') }))).toBe(13.5);
    expect(weeklyHours(schedule({ daysOfWeek: [] }))).toBe(0);
  });
});

describe('scheduleDays — malformed daysOfWeek', () => {
  it('reads a valid ISO weekday array', () => {
    expect(scheduleDays(schedule())).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects payloads that are not ISO weekday arrays, yielding no working days', () => {
    for (const bad of ['mon,tue', { mon: true }, [0, 8], [1, 2, '3'], [1.5], null, 5]) {
      const s = schedule({ daysOfWeek: bad as WorkSchedule['daysOfWeek'] });
      expect(scheduleDays(s)).toEqual([]);
      expect(weeklyHours(s)).toBe(0);
      expect(isWorkingDay(s, parseDateOnly('2026-09-07'))).toBe(false);
    }
  });
});

describe('isWorkingDay', () => {
  it('follows daysOfWeek, not the calendar', () => {
    expect(isWorkingDay(schedule(), parseDateOnly('2026-09-07'))).toBe(true); // Monday
    expect(isWorkingDay(schedule(), parseDateOnly('2026-09-06'))).toBe(false); // Sunday
    expect(isWorkingDay(schedule({ daysOfWeek: [6, 7] }), parseDateOnly('2026-09-06'))).toBe(true);
  });
});

describe('countWorkingDays', () => {
  const from = parseDateOnly('2026-09-05'); // Saturday
  const to = parseDateOnly('2026-09-13'); // Sunday, 9 calendar days later

  it('counts only the scheduled weekdays in an inclusive range', () => {
    expect(countWorkingDays(schedule(), from, to)).toBe(5); // Mon 7 … Fri 11
    expect(countWorkingDays(schedule({ daysOfWeek: [1, 2, 3, 4, 5, 6] }), from, to)).toBe(7);
  });

  it('counts a single day range', () => {
    const monday = parseDateOnly('2026-09-07');
    expect(countWorkingDays(schedule(), monday, monday)).toBe(1);
    expect(countWorkingDays(schedule(), parseDateOnly('2026-09-06'), parseDateOnly('2026-09-06'))).toBe(0);
  });

  it('falls back to every calendar day when no schedule is assigned', () => {
    expect(countWorkingDays(null, from, to)).toBe(9);
  });
});

describe('presentSchedule', () => {
  it('exposes derived hours alongside the formatted times', () => {
    expect(presentSchedule(schedule())).toMatchObject({
      scheduleId: 1,
      scheduleName: 'Standard 9-6',
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '18:00',
      hoursPerDay: 9,
      daysPerWeek: 5,
      weeklyHours: 45,
    });
  });

  it('recomputes weekly hours when the column was never written', () => {
    expect(presentSchedule(schedule({ weeklyHours: null }))).toMatchObject({ weeklyHours: 45 });
    expect(presentSchedule(schedule({ weeklyHours: null, daysOfWeek: [1, 2, 3] }))).toMatchObject({ weeklyHours: 27 });
  });

  it('returns the stored value as a number, not a Decimal or a string', () => {
    const presented = presentSchedule(schedule({ weeklyHours: new Prisma.Decimal('37.50') }));
    expect(presented.weeklyHours).toBe(37.5);
    expect(typeof presented.weeklyHours).toBe('number');
  });

  it('includes assignmentCount only when the relation was counted', () => {
    expect(presentSchedule(schedule())).not.toHaveProperty('assignmentCount');
    expect(presentSchedule({ ...schedule(), _count: { assignments: 3 } })).toMatchObject({ assignmentCount: 3 });
  });
});
