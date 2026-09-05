import type { Prisma, WorkSchedule } from '../../generated/prisma/client';
import { formatTime, parseTime } from '../../lib/dates';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { dailyHours, scheduleDays, weeklyHours } from './resolve';
import type { CreateWorkScheduleInput, ListWorkSchedulesQuery, UpdateWorkScheduleInput } from './schema';

const include = { _count: { select: { assignments: true } } } as const;

export function presentSchedule(s: WorkSchedule & { _count?: { assignments: number } }) {
  return {
    scheduleId: s.scheduleId,
    scheduleName: s.scheduleName,
    daysOfWeek: scheduleDays(s),
    startTime: formatTime(s.startTime),
    endTime: formatTime(s.endTime),
    hoursPerDay: dailyHours(s),
    daysPerWeek: scheduleDays(s).length,
    weeklyHours: s.weeklyHours?.toNumber() ?? weeklyHours(s),
    description: s.description,
    createdAt: s.createdAt,
    ...(s._count ? { assignmentCount: s._count.assignments } : {}),
  };
}

export async function list(query: ListWorkSchedulesQuery) {
  const where: Prisma.WorkScheduleWhereInput = query.q ? { scheduleName: { contains: query.q } } : {};
  const [rows, total] = await Promise.all([
    prisma.workSchedule.findMany({
      where,
      include,
      ...toSkipTake(query),
      orderBy: toOrderBy(query, ['scheduleId', 'scheduleName', 'weeklyHours', 'createdAt'] as const, 'scheduleName'),
    }),
    prisma.workSchedule.count({ where }),
  ]);
  return listResponse(rows.map(presentSchedule), total, query);
}

export async function get(scheduleId: number) {
  const s = await prisma.workSchedule.findUnique({ where: { scheduleId }, include });
  if (!s) throw new NotFoundError('Work schedule', scheduleId);
  return presentSchedule(s);
}

export async function create(input: CreateWorkScheduleInput) {
  const startTime = parseTime(input.startTime);
  const endTime = parseTime(input.endTime);
  const s = await prisma.workSchedule.create({
    data: {
      scheduleName: input.scheduleName,
      daysOfWeek: input.daysOfWeek,
      startTime,
      endTime,
      description: input.description,
      weeklyHours: weeklyHours({ daysOfWeek: input.daysOfWeek, startTime, endTime }),
    },
    include,
  });
  return presentSchedule(s);
}

export async function update(scheduleId: number, input: UpdateWorkScheduleInput) {
  const existing = await prisma.workSchedule.findUnique({ where: { scheduleId } });
  if (!existing) throw new NotFoundError('Work schedule', scheduleId);

  const startTime = input.startTime ? parseTime(input.startTime) : existing.startTime;
  const endTime = input.endTime ? parseTime(input.endTime) : existing.endTime;
  if (endTime.getTime() <= startTime.getTime()) throw new BusinessRuleError('endTime must be after startTime');
  const daysOfWeek = input.daysOfWeek ?? scheduleDays(existing);

  const s = await prisma.workSchedule.update({
    where: { scheduleId },
    data: {
      ...(input.scheduleName !== undefined ? { scheduleName: input.scheduleName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      daysOfWeek,
      startTime,
      endTime,
      weeklyHours: weeklyHours({ daysOfWeek, startTime, endTime }),
    },
    include,
  });
  return presentSchedule(s);
}

export async function remove(scheduleId: number) {
  const s = await get(scheduleId);
  if ((s.assignmentCount ?? 0) > 0) {
    throw new BusinessRuleError(`Schedule is assigned to ${s.assignmentCount} employee record(s) and cannot be deleted`);
  }
  await prisma.workSchedule.delete({ where: { scheduleId } });
}
