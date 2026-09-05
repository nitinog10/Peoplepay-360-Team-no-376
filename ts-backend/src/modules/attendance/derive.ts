/**
 * Pure attendance calculations: pair raw punches into sessions and derive
 * worked hours, breaks, overtime and lateness against a work schedule.
 * Nothing here touches the database.
 */
import { env } from '../../config/env';
import type { AttendanceEntryType, WorkSchedule } from '../../generated/prisma/client';
import { localParts, roundHours, timeToMinutes } from '../../lib/dates';
import { dailyHours, isWorkingDay } from '../work-schedules/resolve';

export interface EntryLike {
  entryType: AttendanceEntryType;
  entryTime: Date;
}

export type SessionState = 'OUT' | 'IN' | 'ON_BREAK';

export interface Analysis {
  valid: boolean;
  error?: string;
  state: SessionState;
  /** Milliseconds inside closed clock-in/clock-out sessions (breaks not yet removed). */
  sessionMs: number;
  /** Milliseconds inside closed breaks. */
  breakMs: number;
  firstClockIn: Date | null;
  lastClockOut: Date | null;
  /** Start of the currently open session (if state != OUT). */
  openSince: Date | null;
  /** Start of the currently open break (if state == ON_BREAK). */
  breakSince: Date | null;
}

const TRANSITIONS: Record<SessionState, Partial<Record<AttendanceEntryType, SessionState>>> = {
  OUT: { CLOCK_IN: 'IN' },
  IN: { CLOCK_OUT: 'OUT', BREAK_START: 'ON_BREAK' },
  ON_BREAK: { BREAK_END: 'IN' },
};

export function nextState(state: SessionState, type: AttendanceEntryType): SessionState | null {
  return TRANSITIONS[state][type] ?? null;
}

export function transitionError(state: SessionState, type: AttendanceEntryType): string {
  switch (type) {
    case 'CLOCK_IN':
      return state === 'ON_BREAK' ? 'You are on a break; end it before clocking in again' : 'You are already clocked in';
    case 'CLOCK_OUT':
      return state === 'OUT' ? 'You are not clocked in' : 'End your break before clocking out';
    case 'BREAK_START':
      return state === 'OUT' ? 'Clock in before starting a break' : 'A break is already in progress';
    case 'BREAK_END':
      return 'No break is in progress';
  }
}

/** Walk the punches in time order through the state machine. */
export function analyse(entries: EntryLike[]): Analysis {
  const sorted = [...entries].sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
  const result: Analysis = {
    valid: true,
    state: 'OUT',
    sessionMs: 0,
    breakMs: 0,
    firstClockIn: null,
    lastClockOut: null,
    openSince: null,
    breakSince: null,
  };
  for (const e of sorted) {
    const next = nextState(result.state, e.entryType);
    if (!next) {
      result.valid = false;
      result.error = `Invalid punch sequence: ${e.entryType} at ${e.entryTime.toISOString()} while ${result.state}`;
      return result;
    }
    switch (e.entryType) {
      case 'CLOCK_IN':
        result.openSince = e.entryTime;
        result.firstClockIn ??= e.entryTime;
        break;
      case 'CLOCK_OUT':
        if (result.openSince) result.sessionMs += e.entryTime.getTime() - result.openSince.getTime();
        result.openSince = null;
        result.lastClockOut = e.entryTime;
        break;
      case 'BREAK_START':
        result.breakSince = e.entryTime;
        break;
      case 'BREAK_END':
        if (result.breakSince) result.breakMs += e.entryTime.getTime() - result.breakSince.getTime();
        result.breakSince = null;
        break;
    }
    result.state = next;
  }
  return result;
}

export interface Derived {
  state: SessionState;
  isValidSequence: boolean;
  sequenceError?: string;
  firstClockIn: Date | null;
  lastClockOut: Date | null;
  /** Hours in closed sessions minus closed breaks. */
  workedHours: number;
  breakHours: number;
  /** Scheduled hours for the day (0 on non-working days or without a schedule). */
  expectedHours: number | null;
  overtimeHours: number;
  isLate: boolean;
  lateByMinutes: number;
  /** Day is in the past and the last session was never closed. */
  missingCheckout: boolean;
  /** Minutes elapsed in the currently open session (live widget). */
  elapsedMinutes: number;
  scheduleName: string | null;
}

export function derive(
  entries: EntryLike[],
  attendanceDate: Date,
  schedule: WorkSchedule | null,
  now: Date = new Date(),
): Derived {
  const a = analyse(entries);
  const workedHours = roundHours(Math.max(0, a.sessionMs - a.breakMs) / 3_600_000);
  const breakHours = roundHours(a.breakMs / 3_600_000);

  const working = schedule ? isWorkingDay(schedule, attendanceDate) : null;
  const expectedHours = schedule ? (working ? dailyHours(schedule) : 0) : null;
  // Without a schedule the expectation is unknown, so no overtime is claimed.
  const overtimeHours = expectedHours === null ? 0 : roundHours(Math.max(0, workedHours - expectedHours));

  let isLate = false;
  let lateByMinutes = 0;
  if (schedule && working && a.firstClockIn) {
    const arrived = localParts(a.firstClockIn).minutesOfDay;
    const due = timeToMinutes(schedule.startTime) + env.LATE_GRACE_MINUTES;
    if (arrived > due) {
      isLate = true;
      lateByMinutes = arrived - due;
    }
  }

  const todayLocalStr = localParts(now).dateStr;
  const recordDateStr = attendanceDate.toISOString().slice(0, 10);
  const open = a.state !== 'OUT';
  const missingCheckout = open && recordDateStr < todayLocalStr;

  let elapsedMinutes = 0;
  if (open && a.openSince && !missingCheckout) {
    const openMs = now.getTime() - a.openSince.getTime();
    const openBreakMs = a.breakSince ? now.getTime() - a.breakSince.getTime() : 0;
    elapsedMinutes = Math.max(0, Math.floor((openMs - openBreakMs) / 60_000));
  }

  return {
    state: a.state,
    isValidSequence: a.valid,
    ...(a.error ? { sequenceError: a.error } : {}),
    firstClockIn: a.firstClockIn,
    lastClockOut: a.lastClockOut,
    workedHours,
    breakHours,
    expectedHours,
    overtimeHours,
    isLate,
    lateByMinutes,
    missingCheckout,
    elapsedMinutes,
    scheduleName: schedule?.scheduleName ?? null,
  };
}
