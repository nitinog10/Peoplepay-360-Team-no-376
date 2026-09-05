/**
 * Date helpers: date-only parsing, TIME values, ISO weekdays and timezone-aware
 * "today". APP_TIMEZONE is pinned to Asia/Kolkata (UTC+5:30) by vitest.config.ts,
 * which is what makes the local-day cases below deterministic.
 */
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  addDays,
  eachDay,
  formatTime,
  isoWeekday,
  localParts,
  parseDateOnly,
  parseTime,
  roundHours,
  startOfUtcDay,
  timeToMinutes,
  toDateOnly,
  todayLocal,
  yearOf,
} from './dates';

describe('parseDateOnly / toDateOnly', () => {
  it('parses YYYY-MM-DD to UTC midnight', () => {
    expect(parseDateOnly('2026-09-07').toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('formats any instant back to its UTC calendar day', () => {
    expect(toDateOnly(new Date('2026-09-07T18:45:12.000Z'))).toBe('2026-09-07');
  });

  it('rejects anything that is not exactly YYYY-MM-DD', () => {
    for (const bad of ['05-09-2026', '2026-9-7', '2026-09-07T00:00:00Z', '2026/09/07', '']) {
      expect(() => parseDateOnly(bad)).toThrow(/Invalid date-only value/);
    }
  });

  it('rejects calendar dates that do not exist instead of rolling them over', () => {
    // new Date('2026-02-30T00:00:00Z') silently becomes 2026-03-02, so the
    // round-trip guard inside parseDateOnly is the only thing catching this.
    expect(() => parseDateOnly('2026-02-30')).toThrow(/Invalid calendar date/);
    expect(() => parseDateOnly('2026-13-01')).toThrow(/Invalid calendar date/);
    expect(() => parseDateOnly('2025-02-29')).toThrow(/Invalid calendar date/);
    expect(parseDateOnly('2024-02-29').toISOString()).toBe('2024-02-29T00:00:00.000Z'); // 2024 is a leap year
  });
});

describe('day arithmetic', () => {
  it('normalises an instant to the start of its UTC day', () => {
    expect(startOfUtcDay(new Date('2026-09-07T23:59:59.999Z')).toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('adds and subtracts whole days', () => {
    const monday = parseDateOnly('2026-09-07');
    expect(toDateOnly(addDays(monday, 1))).toBe('2026-09-08');
    expect(toDateOnly(addDays(monday, -3))).toBe('2026-09-04');
    expect(addDays(monday, 1).getTime() - monday.getTime()).toBe(DAY_MS);
  });

  it('iterates a range inclusively', () => {
    const days = [...eachDay(parseDateOnly('2026-09-05'), parseDateOnly('2026-09-08'))].map(toDateOnly);
    expect(days).toEqual(['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08']);
  });

  it('yields nothing when the range is inverted', () => {
    expect([...eachDay(parseDateOnly('2026-09-08'), parseDateOnly('2026-09-05'))]).toEqual([]);
  });

  it('reads the year off a date-only value', () => {
    expect(yearOf(parseDateOnly('2026-01-01'))).toBe(2026);
  });
});

describe('isoWeekday', () => {
  it('numbers Monday 1 through Sunday 7', () => {
    expect(isoWeekday(parseDateOnly('2026-09-07'))).toBe(1); // Monday
    expect(isoWeekday(parseDateOnly('2026-09-11'))).toBe(5); // Friday
    expect(isoWeekday(parseDateOnly('2026-09-05'))).toBe(6); // Saturday
    expect(isoWeekday(parseDateOnly('2026-09-06'))).toBe(7); // Sunday, not 0
  });
});

describe('TIME values', () => {
  it('parses HH:MM and HH:MM:SS onto 1970-01-01 UTC', () => {
    expect(parseTime('09:00').toISOString()).toBe('1970-01-01T09:00:00.000Z');
    expect(parseTime('18:30:45').toISOString()).toBe('1970-01-01T18:30:45.000Z');
  });

  it('round-trips through formatTime and converts to minutes', () => {
    expect(formatTime(parseTime('09:05'))).toBe('09:05');
    expect(timeToMinutes(parseTime('18:30'))).toBe(1110);
    expect(timeToMinutes(parseTime('18:30:45'))).toBe(1110); // stray seconds are floored away
  });

  it('rejects out-of-range and loosely formatted times', () => {
    for (const bad of ['24:00', '9:00', '12:60', '09:00:60', 'noon', '']) {
      expect(() => parseTime(bad)).toThrow(/Invalid time value/);
    }
  });
});

describe('roundHours', () => {
  it('rounds to two decimals by default', () => {
    expect(roundHours(8.456)).toBe(8.46);
    expect(roundHours(1 / 3)).toBe(0.33);
    expect(roundHours(9.999)).toBe(10);
    expect(roundHours(8.5)).toBe(8.5);
  });

  it('honours an explicit precision', () => {
    expect(roundHours(1 / 3, 3)).toBe(0.333);
    expect(roundHours(8.456, 0)).toBe(8);
  });
});

describe('localParts / todayLocal (timezone aware)', () => {
  // 19:30 UTC is already 01:00 the next morning in Asia/Kolkata.
  const instant = new Date('2026-09-05T19:30:00.000Z');

  it('resolves the instant onto the app timezone calendar day', () => {
    const parts = localParts(instant);
    expect(parts.dateStr).toBe('2026-09-06');
    expect(parts.minutesOfDay).toBe(60);
    expect(parts.isoWeekday).toBe(7);
    expect(parts.dateOnly.toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });

  it('gives a different day for the same instant in another zone', () => {
    const utc = localParts(instant, 'UTC');
    expect(utc.dateStr).toBe('2026-09-05');
    expect(utc.minutesOfDay).toBe(19 * 60 + 30);
    expect(utc.isoWeekday).toBe(6);
  });

  it('reads midnight local as minute 0, not as the previous day', () => {
    // 18:30 UTC is exactly 00:00 IST the next day.
    expect(localParts(new Date('2026-09-06T18:30:00.000Z'))).toMatchObject({
      dateStr: '2026-09-07',
      minutesOfDay: 0,
    });
  });

  it('derives today from the app timezone, not from UTC', () => {
    expect(toDateOnly(todayLocal(instant))).toBe('2026-09-06');
  });

  it('rejects an unknown timezone', () => {
    expect(() => localParts(instant, 'Not/AZone')).toThrow(RangeError);
  });
});
