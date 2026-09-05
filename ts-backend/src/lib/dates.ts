/**
 * Date helpers.
 *
 * Conventions:
 *  - DATE columns are handled as JS Dates at UTC midnight ("date-only" values).
 *  - TIME columns are handled as JS Dates on 1970-01-01 UTC.
 *  - "Local" calculations (which calendar day a punch belongs to, whether a
 *    clock-in is late) use APP_TIMEZONE from the environment.
 */
import { env } from '../config/env';

export const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** 'YYYY-MM-DD' → Date at UTC midnight. Throws on invalid input. */
export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY_RE.test(value)) throw new Error(`Invalid date-only value "${value}"`);
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || toDateOnly(d) !== value) throw new Error(`Invalid calendar date "${value}"`);
  return d;
}

/** Date → 'YYYY-MM-DD' using UTC fields. */
export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Normalise any Date to UTC midnight of its UTC calendar day. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Inclusive iteration over date-only values. */
export function* eachDay(start: Date, end: Date): Generator<Date> {
  for (let cur = startOfUtcDay(start); cur.getTime() <= end.getTime(); cur = addDays(cur, 1)) {
    yield cur;
  }
}

/** ISO weekday for a date-only value: 1 = Monday … 7 = Sunday. */
export function isoWeekday(dateOnly: Date): number {
  const js = dateOnly.getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/** 'HH:MM' or 'HH:MM:SS' → Date on 1970-01-01 UTC (matches MySQL TIME via Prisma). */
export function parseTime(value: string): Date {
  const m = TIME_RE.exec(value);
  if (!m) throw new Error(`Invalid time value "${value}"`);
  return new Date(Date.UTC(1970, 0, 1, Number(m[1]), Number(m[2]), Number(m[3] ?? 0)));
}

/** Date (TIME column) → 'HH:MM'. */
export function formatTime(t: Date): string {
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Minutes since midnight for a TIME value. */
export function timeToMinutes(t: Date): number {
  return t.getUTCHours() * 60 + t.getUTCMinutes() + Math.floor(t.getUTCSeconds() / 60);
}

export function roundHours(hours: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(hours * f) / f;
}

/**
 * Break an instant into the calendar day / minutes-of-day it falls on in the
 * given IANA timezone (defaults to APP_TIMEZONE).
 */
export function localParts(instant: Date, timeZone: string = env.APP_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const minutesOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  const dateOnly = parseDateOnly(dateStr);
  return { dateStr, dateOnly, minutesOfDay, isoWeekday: isoWeekday(dateOnly) };
}

/** Today's date-only value in the app timezone. */
export function todayLocal(now: Date = new Date()): Date {
  return localParts(now).dateOnly;
}

export function yearOf(dateOnly: Date): number {
  return dateOnly.getUTCFullYear();
}
