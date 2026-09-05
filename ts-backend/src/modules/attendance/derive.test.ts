/**
 * Attendance derivation: the punch state machine, worked / break / expected /
 * overtime hours, lateness, missing check-out and the live elapsed timer.
 *
 * vitest.config.ts pins APP_TIMEZONE to Asia/Kolkata (UTC+5:30) and
 * LATE_GRACE_MINUTES to 10, so punches are written as UTC instants with the local
 * time in a comment: 09:00 IST = 03:30Z. `now` is always passed explicitly —
 * nothing here may depend on the day the suite happens to run.
 */
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client';
import type { AttendanceEntryType, WorkSchedule } from '../../generated/prisma/client';
import { parseDateOnly, parseTime } from '../../lib/dates';
import { analyse, derive, nextState, transitionError, type EntryLike } from './derive';

const MONDAY = parseDateOnly('2026-09-07');
const SUNDAY = parseDateOnly('2026-09-06');

/** 19:30 IST on the Monday — after the working day, same local date. */
const AFTER_HOURS = new Date('2026-09-07T14:00:00Z');
/** 11:30 IST on the Monday — mid-shift, for the live timer. */
const MID_MORNING = new Date('2026-09-07T06:00:00Z');
/** 10:30 IST on the following Thursday — the Monday is now in the past. */
const NEXT_WEEK = new Date('2026-09-10T05:00:00Z');

/** Mon–Fri 09:00–18:00 → 9 h expected per working day. */
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

function punch(entryType: AttendanceEntryType, iso: string): EntryLike {
  return { entryType, entryTime: new Date(iso) };
}

/** In 09:00, break 13:00–13:30, out 18:00 (IST) → 8.5 h worked, 0.5 h break. */
const FULL_DAY: EntryLike[] = [
  punch('CLOCK_IN', '2026-09-07T03:30:00Z'),
  punch('BREAK_START', '2026-09-07T07:30:00Z'),
  punch('BREAK_END', '2026-09-07T08:00:00Z'),
  punch('CLOCK_OUT', '2026-09-07T12:30:00Z'),
];

const HOUR_MS = 3_600_000;

describe('analyse — punch state machine', () => {
  it('sorts punches by time and pairs sessions with breaks', () => {
    const shuffled = [FULL_DAY[3], FULL_DAY[0], FULL_DAY[2], FULL_DAY[1]];
    const a = analyse(shuffled);
    expect(a.valid).toBe(true);
    expect(a.state).toBe('OUT');
    expect(a.sessionMs).toBe(9 * HOUR_MS);
    expect(a.breakMs).toBe(0.5 * HOUR_MS);
    expect(a.firstClockIn?.toISOString()).toBe('2026-09-07T03:30:00.000Z');
    expect(a.lastClockOut?.toISOString()).toBe('2026-09-07T12:30:00.000Z');
    expect(a.openSince).toBeNull();
    expect(a.breakSince).toBeNull();
  });

  it('leaves an unfinished session open', () => {
    const a = analyse([punch('CLOCK_IN', '2026-09-07T03:30:00Z')]);
    expect(a.state).toBe('IN');
    expect(a.openSince?.toISOString()).toBe('2026-09-07T03:30:00.000Z');
    expect(a.sessionMs).toBe(0);
    expect(a.lastClockOut).toBeNull();
  });

  it('tracks an open break', () => {
    const a = analyse([punch('CLOCK_IN', '2026-09-07T03:30:00Z'), punch('BREAK_START', '2026-09-07T07:30:00Z')]);
    expect(a.state).toBe('ON_BREAK');
    expect(a.breakSince?.toISOString()).toBe('2026-09-07T07:30:00.000Z');
    expect(a.breakMs).toBe(0);
  });

  it('keeps the first clock-in and the last clock-out across several sessions', () => {
    const a = analyse([
      punch('CLOCK_IN', '2026-09-07T03:30:00Z'),
      punch('CLOCK_OUT', '2026-09-07T07:30:00Z'),
      punch('CLOCK_IN', '2026-09-07T08:30:00Z'),
      punch('CLOCK_OUT', '2026-09-07T12:30:00Z'),
    ]);
    expect(a.sessionMs).toBe(8 * HOUR_MS);
    expect(a.firstClockIn?.toISOString()).toBe('2026-09-07T03:30:00.000Z');
    expect(a.lastClockOut?.toISOString()).toBe('2026-09-07T12:30:00.000Z');
  });

  it('rejects a second clock-in and stops counting there', () => {
    const a = analyse([punch('CLOCK_IN', '2026-09-07T03:30:00Z'), punch('CLOCK_IN', '2026-09-07T04:00:00Z')]);
    expect(a.valid).toBe(false);
    expect(a.error).toMatch(/Invalid punch sequence: CLOCK_IN/);
    expect(a.sessionMs).toBe(0);
    expect(a.state).toBe('IN');
  });

  it('rejects clocking out during a break', () => {
    const a = analyse([
      punch('CLOCK_IN', '2026-09-07T03:30:00Z'),
      punch('BREAK_START', '2026-09-07T07:30:00Z'),
      punch('CLOCK_OUT', '2026-09-07T12:30:00Z'),
    ]);
    expect(a.valid).toBe(false);
    expect(a.error).toMatch(/CLOCK_OUT/);
    expect(a.state).toBe('ON_BREAK');
  });

  it('rejects ending a break that never started, and clocking out with no session', () => {
    expect(analyse([punch('CLOCK_IN', '2026-09-07T03:30:00Z'), punch('BREAK_END', '2026-09-07T08:00:00Z')]).valid).toBe(
      false,
    );
    const orphan = analyse([punch('CLOCK_OUT', '2026-09-07T12:30:00Z')]);
    expect(orphan.valid).toBe(false);
    expect(orphan.state).toBe('OUT');
  });

  it('maps every allowed transition and names every refusal', () => {
    expect(nextState('OUT', 'CLOCK_IN')).toBe('IN');
    expect(nextState('IN', 'BREAK_START')).toBe('ON_BREAK');
    expect(nextState('ON_BREAK', 'BREAK_END')).toBe('IN');
    expect(nextState('IN', 'CLOCK_OUT')).toBe('OUT');

    expect(nextState('OUT', 'CLOCK_OUT')).toBeNull();
    expect(nextState('OUT', 'BREAK_START')).toBeNull();
    expect(nextState('IN', 'CLOCK_IN')).toBeNull();
    expect(nextState('IN', 'BREAK_END')).toBeNull();
    expect(nextState('ON_BREAK', 'CLOCK_IN')).toBeNull();
    expect(nextState('ON_BREAK', 'CLOCK_OUT')).toBeNull();

    expect(transitionError('IN', 'CLOCK_IN')).toBe('You are already clocked in');
    expect(transitionError('ON_BREAK', 'CLOCK_IN')).toBe('You are on a break; end it before clocking in again');
    expect(transitionError('OUT', 'CLOCK_OUT')).toBe('You are not clocked in');
    expect(transitionError('ON_BREAK', 'CLOCK_OUT')).toBe('End your break before clocking out');
    expect(transitionError('OUT', 'BREAK_START')).toBe('Clock in before starting a break');
    expect(transitionError('ON_BREAK', 'BREAK_START')).toBe('A break is already in progress');
    expect(transitionError('IN', 'BREAK_END')).toBe('No break is in progress');
  });
});

describe('derive — worked, break, expected and overtime hours', () => {
  it('removes closed breaks from the session length', () => {
    const d = derive(FULL_DAY, MONDAY, schedule(), AFTER_HOURS);
    expect(d).toMatchObject({
      state: 'OUT',
      isValidSequence: true,
      workedHours: 8.5,
      breakHours: 0.5,
      expectedHours: 9,
      overtimeHours: 0,
      isLate: false,
      lateByMinutes: 0,
      missingCheckout: false,
      elapsedMinutes: 0,
      scheduleName: 'Standard 9-6',
    });
    expect(d.firstClockIn?.toISOString()).toBe('2026-09-07T03:30:00.000Z');
    expect(d.lastClockOut?.toISOString()).toBe('2026-09-07T12:30:00.000Z');
    expect(d).not.toHaveProperty('sequenceError');
  });

  it('counts hours beyond the scheduled day as overtime', () => {
    // 09:00 → 20:30 IST = 11.5 h against a 9 h day.
    const d = derive(
      [punch('CLOCK_IN', '2026-09-07T03:30:00Z'), punch('CLOCK_OUT', '2026-09-07T15:00:00Z')],
      MONDAY,
      schedule(),
      AFTER_HOURS,
    );
    expect(d.workedHours).toBe(11.5);
    expect(d.expectedHours).toBe(9);
    expect(d.overtimeHours).toBe(2.5);
  });

  it('expects nothing on a non-working day, so every hour is overtime', () => {
    const d = derive(
      [punch('CLOCK_IN', '2026-09-06T03:30:00Z'), punch('CLOCK_OUT', '2026-09-06T07:30:00Z')],
      SUNDAY,
      schedule(),
      AFTER_HOURS,
    );
    expect(d.expectedHours).toBe(0);
    expect(d.workedHours).toBe(4);
    expect(d.overtimeHours).toBe(4);
  });

  it('claims no overtime when the employee has no schedule', () => {
    const d = derive(FULL_DAY, MONDAY, null, AFTER_HOURS);
    expect(d.expectedHours).toBeNull(); // unknown, not zero
    expect(d.overtimeHours).toBe(0);
    expect(d.workedHours).toBe(8.5);
    expect(d.scheduleName).toBeNull();
  });

  it('never reports negative worked hours when a break outlasts the closed session', () => {
    // Clock in 09:00, break 10:00–11:00, still clocked in: the session is open so
    // sessionMs is 0 while breakMs is an hour.
    const d = derive(
      [
        punch('CLOCK_IN', '2026-09-07T03:30:00Z'),
        punch('BREAK_START', '2026-09-07T04:30:00Z'),
        punch('BREAK_END', '2026-09-07T05:30:00Z'),
      ],
      MONDAY,
      schedule(),
      MID_MORNING,
    );
    expect(d.workedHours).toBe(0);
    expect(d.breakHours).toBe(1);
    expect(d.state).toBe('IN');
    expect(d.elapsedMinutes).toBe(150); // the live timer counts the open session, closed breaks included
  });

  it('reports a day with no punches as zero worked against the expectation', () => {
    const d = derive([], MONDAY, schedule(), AFTER_HOURS);
    expect(d).toMatchObject({ workedHours: 0, breakHours: 0, expectedHours: 9, overtimeHours: 0, state: 'OUT' });
    expect(d.firstClockIn).toBeNull();
    expect(d.missingCheckout).toBe(false);
  });
});

describe('derive — lateness (schedule start + LATE_GRACE_MINUTES)', () => {
  /** A closed 8-hour day whose only variable is the arrival instant. */
  function arrivedAt(iso: string, s: WorkSchedule | null = schedule(), date = MONDAY) {
    const inAt = new Date(iso);
    const entries: EntryLike[] = [
      { entryType: 'CLOCK_IN', entryTime: inAt },
      { entryType: 'CLOCK_OUT', entryTime: new Date(inAt.getTime() + 8 * HOUR_MS) },
    ];
    return derive(entries, date, s, AFTER_HOURS);
  }

  it('is not late inside the grace window', () => {
    expect(arrivedAt('2026-09-07T03:00:00Z')).toMatchObject({ isLate: false, lateByMinutes: 0 }); // 08:30 IST
    expect(arrivedAt('2026-09-07T03:30:00Z')).toMatchObject({ isLate: false, lateByMinutes: 0 }); // 09:00 IST
    expect(arrivedAt('2026-09-07T03:40:00Z')).toMatchObject({ isLate: false, lateByMinutes: 0 }); // 09:10, grace ends
  });

  it('is late from the first minute past the grace window', () => {
    expect(arrivedAt('2026-09-07T03:41:00Z')).toMatchObject({ isLate: true, lateByMinutes: 1 }); // 09:11 IST
    expect(arrivedAt('2026-09-07T04:15:00Z')).toMatchObject({ isLate: true, lateByMinutes: 35 }); // 09:45 IST
  });

  it('measures against the schedule start, not a hardcoded office hour', () => {
    const late = arrivedAt('2026-09-07T06:00:00Z', schedule({ startTime: parseTime('11:00') })); // 11:30 IST
    expect(late).toMatchObject({ isLate: true, lateByMinutes: 20 });
    const early = arrivedAt('2026-09-07T06:00:00Z', schedule({ startTime: parseTime('12:00') }));
    expect(early).toMatchObject({ isLate: false, lateByMinutes: 0 });
  });

  it('cannot be late without a schedule or on a non-working day', () => {
    expect(arrivedAt('2026-09-07T06:00:00Z', null)).toMatchObject({ isLate: false, lateByMinutes: 0 });
    expect(arrivedAt('2026-09-06T06:00:00Z', schedule(), SUNDAY)).toMatchObject({ isLate: false, lateByMinutes: 0 });
  });
});

describe('derive — missing check-out and the live timer', () => {
  const openSession = [punch('CLOCK_IN', '2026-09-07T03:30:00Z')];

  it('flags a session left open on a past day and stops the timer', () => {
    const d = derive(openSession, MONDAY, schedule(), NEXT_WEEK);
    expect(d).toMatchObject({ state: 'IN', missingCheckout: true, elapsedMinutes: 0 });
  });

  it('runs the timer for a session that is still open today', () => {
    const d = derive(openSession, MONDAY, schedule(), MID_MORNING); // 09:00 → 11:30 IST
    expect(d).toMatchObject({ missingCheckout: false, elapsedMinutes: 150 });
  });

  it('pauses the timer while a break is open', () => {
    const d = derive(
      [...openSession, punch('BREAK_START', '2026-09-07T05:30:00Z')], // break from 11:00 IST
      MONDAY,
      schedule(),
      MID_MORNING,
    );
    expect(d).toMatchObject({ state: 'ON_BREAK', elapsedMinutes: 120 }); // 150 open − 30 on break
  });

  it('decides "past day" in the app timezone, not in UTC', () => {
    // 19:00Z is still 2026-09-07 in UTC but already 00:30 on 2026-09-08 in IST,
    // so the Monday session counts as a missing check-out.
    const d = derive(openSession, MONDAY, schedule(), new Date('2026-09-07T19:00:00Z'));
    expect(d).toMatchObject({ missingCheckout: true, elapsedMinutes: 0 });
  });

  it('never flags a closed day, however long ago it was', () => {
    expect(derive(FULL_DAY, MONDAY, schedule(), NEXT_WEEK)).toMatchObject({
      missingCheckout: false,
      elapsedMinutes: 0,
      workedHours: 8.5,
    });
  });
});

describe('derive — an invalid sequence claims no hours', () => {
  it('surfaces the sequence error and reports zeros', () => {
    const d = derive(
      [punch('CLOCK_IN', '2026-09-07T03:30:00Z'), punch('CLOCK_IN', '2026-09-07T04:00:00Z')],
      MONDAY,
      schedule(),
      AFTER_HOURS,
    );
    expect(d.isValidSequence).toBe(false);
    expect(d.sequenceError).toMatch(/Invalid punch sequence: CLOCK_IN/);
    expect(d.workedHours).toBe(0);
    expect(d.breakHours).toBe(0);
    expect(d.overtimeHours).toBe(0);
    expect(d.expectedHours).toBe(9); // the expectation is still known
  });
});


