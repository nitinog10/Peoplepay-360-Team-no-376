/**
 * Schedule resolution helpers shared by attendance and time-off.
 * An employee's schedule on a given date is the assignment whose
 * [effectiveFrom, effectiveTo ?? ∞] range contains that date.
 */
import { z } from 'zod';
import type { WorkSchedule } from '../../generated/prisma/client';
import { isoWeekday, roundHours, timeToMinutes } from '../../lib/dates';
import { prisma } from '../../lib/prisma';

const daysJson = z.array(z.number().int().min(1).max(7));

export function scheduleDays(schedule: Pick<WorkSchedule, 'daysOfWeek'>): number[] {
  const parsed = daysJson.safeParse(schedule.daysOfWeek);
  return parsed.success ? parsed.data : [];
}

/** Scheduled hours for one working day. */
export function dailyHours(schedule: Pick<WorkSchedule, 'startTime' | 'endTime'>): number {
  return roundHours((timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime)) / 60);
}

export function weeklyHours(schedule: Pick<WorkSchedule, 'daysOfWeek' | 'startTime' | 'endTime'>): number {
  return roundHours(scheduleDays(schedule).length * dailyHours(schedule));
}

export function isWorkingDay(schedule: Pick<WorkSchedule, 'daysOfWeek'>, dateOnly: Date): boolean {
  return scheduleDays(schedule).includes(isoWeekday(dateOnly));
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;

/** The schedule applicable to an employee on a date, or null when none is assigned. */
export async function resolveScheduleFor(employeeId: number, dateOnly: Date, tx: Tx = prisma) {
  const assignment = await tx.employeeScheduleAssignment.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: dateOnly },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateOnly } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    include: { schedule: true },
  });
  return assignment?.schedule ?? null;
}

/**
 * Count working days in an inclusive date range. With no schedule every
 * calendar day counts (so the rule is still data-driven, never a hardcoded 5-day week).
 */
export function countWorkingDays(schedule: Pick<WorkSchedule, 'daysOfWeek'> | null, start: Date, end: Date): number {
  const days = schedule ? scheduleDays(schedule) : null;
  let n = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    if (!days || days.includes(isoWeekday(d))) n++;
  }
  return n;
}
