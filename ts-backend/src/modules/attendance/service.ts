import { scopeToEmployee } from '../../auth/permissions';
import type { AttendanceEntryType, Prisma, WorkSchedule } from '../../generated/prisma/client';
import { localParts, todayLocal } from '../../lib/dates';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { Actor } from '../../lib/security';
import { isWorkingDay, resolveScheduleFor } from '../work-schedules/resolve';
import { analyse, derive, nextState, transitionError } from './derive';
import type {
  CreateRecordInput,
  EntryInput,
  ListRecordsQuery,
  MarkAbsencesInput,
  PunchInput,
  UpdateEntryInput,
  UpdateRecordInput,
} from './schema';

const include = {
  employee: {
    select: {
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      department: { select: { departmentId: true, departmentName: true } },
      manager: { select: { employeeId: true, firstName: true, lastName: true } },
    },
  },
  entries: { orderBy: { entryTime: 'asc' } },
} satisfies Prisma.AttendanceRecordInclude;

type RecordRow = Prisma.AttendanceRecordGetPayload<{ include: typeof include }>;

/**
 * Resolves schedules for many (employee, date) pairs with one query per employee,
 * so list endpoints do not pay N+1 for derived fields.
 */
export class ScheduleCache {
  private assignments = new Map<number, Promise<{ effectiveFrom: Date; effectiveTo: Date | null; schedule: WorkSchedule }[]>>();

  async for(employeeId: number, dateOnly: Date): Promise<WorkSchedule | null> {
    let p = this.assignments.get(employeeId);
    if (!p) {
      p = prisma.employeeScheduleAssignment.findMany({
        where: { employeeId },
        include: { schedule: true },
        orderBy: { effectiveFrom: 'desc' },
      });
      this.assignments.set(employeeId, p);
    }
    const rows = await p;
    const t = dateOnly.getTime();
    const hit = rows.find((a) => a.effectiveFrom.getTime() <= t && (a.effectiveTo === null || a.effectiveTo.getTime() >= t));
    return hit?.schedule ?? null;
  }
}

async function present(r: RecordRow, cache = new ScheduleCache(), now = new Date()) {
  const schedule = await cache.for(r.employeeId, r.attendanceDate);
  return { ...r, derived: derive(r.entries, r.attendanceDate, schedule, now) };
}

async function findOrThrow(attendanceRecordId: number): Promise<RecordRow> {
  const r = await prisma.attendanceRecord.findUnique({ where: { attendanceRecordId }, include });
  if (!r) throw new NotFoundError('Attendance record', attendanceRecordId);
  return r;
}

// ---------- self-service punches ----------

export async function punch(actor: Actor, type: AttendanceEntryType, input: PunchInput) {
  const now = new Date();
  const today = localParts(now).dateOnly;
  const employeeId = actor.employeeId;

  const employee = await prisma.employee.findUnique({ where: { employeeId }, select: { status: true } });
  if (!employee) throw new NotFoundError('Employee', employeeId);
  if (employee.status !== 'ACTIVE') throw new BusinessRuleError('Only active employees can record attendance');

  await prisma.$transaction(async (tx) => {
    let record = await tx.attendanceRecord.findUnique({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate: today } },
      include: { entries: true },
    });
    const state = analyse(record?.entries ?? []).state;
    if (!nextState(state, type)) throw new BusinessRuleError(transitionError(state, type));

    if (!record) {
      record = await tx.attendanceRecord.create({
        data: { employeeId, attendanceDate: today, status: 'PRESENT' },
        include: { entries: true },
      });
    } else if (record.status !== 'PRESENT' && record.status !== 'HALF_DAY') {
      // A punch on a day previously marked ABSENT/WEEK_OFF/etc. means the employee is present after all.
      await tx.attendanceRecord.update({ where: { attendanceRecordId: record.attendanceRecordId }, data: { status: 'PRESENT' } });
    }
    await tx.attendanceEntry.create({
      data: { attendanceRecordId: record.attendanceRecordId, entryType: type, entryTime: now, source: input.source },
    });
  });

  return session(actor, now);
}

/** Current-day state for the header widget. */
export async function session(actor: Actor, now: Date = new Date()) {
  const today = localParts(now).dateOnly;
  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_attendanceDate: { employeeId: actor.employeeId, attendanceDate: today } },
    include,
  });
  const schedule = await resolveScheduleFor(actor.employeeId, today);
  const derived = derive(record?.entries ?? [], today, schedule, now);
  const allowed = (['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END'] as AttendanceEntryType[]).filter((t) =>
    nextState(derived.state, t),
  );
  return {
    date: today,
    checkedIn: derived.state !== 'OUT',
    onBreak: derived.state === 'ON_BREAK',
    state: derived.state,
    allowedActions: allowed,
    derived,
    record,
    serverTime: now,
  };
}

// ---------- records ----------

export async function list(actor: Actor, query: ListRecordsQuery) {
  const own = scopeToEmployee(actor, query.employeeId);
  const where: Prisma.AttendanceRecordWhereInput = {
    ...(own !== undefined ? { employeeId: own } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.date ? { attendanceDate: query.date } : {}),
    ...(query.from || query.to
      ? { attendanceDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.q
      ? {
          employee: {
            OR: [{ firstName: { contains: query.q } }, { lastName: { contains: query.q } }, { email: { contains: query.q } }],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['attendanceDate', 'attendanceRecordId', 'status', 'employeeId'] as const, 'attendanceDate'),
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  const cache = new ScheduleCache();
  const now = new Date();
  const data = await Promise.all(rows.map((r) => present(r, cache, now)));
  return listResponse(data, total, query);
}

export async function get(actor: Actor, attendanceRecordId: number) {
  const r = await findOrThrow(attendanceRecordId);
  scopeToEmployee(actor, r.employeeId);
  return present(r);
}

function assertValidSequence(entries: { entryType: AttendanceEntryType; entryTime: Date }[]) {
  const a = analyse(entries);
  if (!a.valid) throw new BusinessRuleError(a.error ?? 'Invalid punch sequence');
}

export async function createRecord(input: CreateRecordInput) {
  const employee = await prisma.employee.findUnique({ where: { employeeId: input.employeeId } });
  if (!employee) throw new NotFoundError('Employee', input.employeeId);
  const dup = await prisma.attendanceRecord.findUnique({
    where: { employeeId_attendanceDate: { employeeId: input.employeeId, attendanceDate: input.attendanceDate } },
  });
  if (dup) throw new ConflictError('An attendance record already exists for this employee and date', { attendanceRecordId: dup.attendanceRecordId });
  assertValidSequence(input.entries);

  const created = await prisma.attendanceRecord.create({
    data: {
      employeeId: input.employeeId,
      attendanceDate: input.attendanceDate,
      status: input.status,
      notes: input.notes ?? null,
      entries: { create: input.entries.map((e) => ({ entryType: e.entryType, entryTime: e.entryTime, source: e.source })) },
    },
    include,
  });
  return present(created);
}

export async function updateRecord(attendanceRecordId: number, input: UpdateRecordInput) {
  const existing = await findOrThrow(attendanceRecordId);
  if (input.attendanceDate && input.attendanceDate.getTime() !== existing.attendanceDate.getTime()) {
    const dup = await prisma.attendanceRecord.findUnique({
      where: { employeeId_attendanceDate: { employeeId: existing.employeeId, attendanceDate: input.attendanceDate } },
    });
    if (dup) throw new ConflictError('Another attendance record already exists for that date');
  }
  const updated = await prisma.attendanceRecord.update({ where: { attendanceRecordId }, data: input, include });
  return present(updated);
}

export async function removeRecord(attendanceRecordId: number) {
  await findOrThrow(attendanceRecordId);
  await prisma.attendanceRecord.delete({ where: { attendanceRecordId } });
}

// ---------- entries (HR corrections) ----------

export async function addEntry(attendanceRecordId: number, input: EntryInput) {
  const record = await findOrThrow(attendanceRecordId);
  assertValidSequence([...record.entries, { entryType: input.entryType, entryTime: input.entryTime }]);
  await prisma.attendanceEntry.create({ data: { attendanceRecordId, ...input } });
  return present(await findOrThrow(attendanceRecordId));
}

export async function updateEntry(attendanceEntryId: number, input: UpdateEntryInput) {
  const entry = await prisma.attendanceEntry.findUnique({ where: { attendanceEntryId } });
  if (!entry) throw new NotFoundError('Attendance entry', attendanceEntryId);
  const record = await findOrThrow(entry.attendanceRecordId);
  const proposed = record.entries.map((e) =>
    e.attendanceEntryId === attendanceEntryId
      ? { entryType: input.entryType ?? e.entryType, entryTime: input.entryTime ?? e.entryTime }
      : e,
  );
  assertValidSequence(proposed);
  await prisma.attendanceEntry.update({ where: { attendanceEntryId }, data: input });
  return present(await findOrThrow(entry.attendanceRecordId));
}

export async function removeEntry(attendanceEntryId: number) {
  const entry = await prisma.attendanceEntry.findUnique({ where: { attendanceEntryId } });
  if (!entry) throw new NotFoundError('Attendance entry', attendanceEntryId);
  const record = await findOrThrow(entry.attendanceRecordId);
  assertValidSequence(record.entries.filter((e) => e.attendanceEntryId !== attendanceEntryId));
  await prisma.attendanceEntry.delete({ where: { attendanceEntryId } });
  return present(await findOrThrow(entry.attendanceRecordId));
}

// ---------- day close ----------

/**
 * Create summary rows for a past/current day for every active employee without one:
 * ON_LEAVE when an approved request covers the day, WEEK_OFF on non-working days,
 * ABSENT otherwise. Employees without a schedule are skipped (no expectation to judge against).
 */
export async function markAbsences(input: MarkAbsencesInput) {
  const date = input.date;
  if (date.getTime() > todayLocal().getTime()) throw new BusinessRuleError('Cannot mark absences for a future date');

  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      hireDate: { lte: date },
      OR: [{ terminationDate: null }, { terminationDate: { gte: date } }],
    },
    select: { employeeId: true },
  });
  const ids = employees.map((e) => e.employeeId);
  if (ids.length === 0) return { date, created: { ABSENT: 0, ON_LEAVE: 0, WEEK_OFF: 0 }, skipped: { hasRecord: 0, noSchedule: 0 } };

  const [existing, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { attendanceDate: date, employeeId: { in: ids } }, select: { employeeId: true } }),
    prisma.timeOffRequest.findMany({
      where: { status: 'APPROVED', employeeId: { in: ids }, startDate: { lte: date }, endDate: { gte: date } },
      select: { employeeId: true },
    }),
  ]);
  const hasRecord = new Set(existing.map((e) => e.employeeId));
  const onLeave = new Set(leaves.map((l) => l.employeeId));

  const cache = new ScheduleCache();
  const created = { ABSENT: 0, ON_LEAVE: 0, WEEK_OFF: 0 };
  const skipped = { hasRecord: 0, noSchedule: 0 };
  const rows: Prisma.AttendanceRecordCreateManyInput[] = [];

  for (const employeeId of ids) {
    if (hasRecord.has(employeeId)) {
      skipped.hasRecord++;
      continue;
    }
    const schedule = await cache.for(employeeId, date);
    let status: 'ABSENT' | 'ON_LEAVE' | 'WEEK_OFF';
    if (onLeave.has(employeeId)) status = 'ON_LEAVE';
    else if (!schedule) {
      skipped.noSchedule++;
      continue;
    } else if (!isWorkingDay(schedule, date)) status = 'WEEK_OFF';
    else status = 'ABSENT';
    created[status]++;
    rows.push({ employeeId, attendanceDate: date, status, notes: 'System-generated by day close' });
  }
  if (rows.length > 0) await prisma.attendanceRecord.createMany({ data: rows });
  return { date, created, skipped };
}
