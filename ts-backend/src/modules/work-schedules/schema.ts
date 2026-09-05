import { z } from 'zod';
import { paginationSchema } from '../../lib/http';

export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24h)');

export const daysOfWeekSchema = z
  .array(z.number().int().min(1, 'ISO weekday 1 (Mon) – 7 (Sun)').max(7, 'ISO weekday 1 (Mon) – 7 (Sun)'))
  .min(1, 'At least one working day is required')
  .max(7)
  .refine((d) => new Set(d).size === d.length, { message: 'Weekdays must be unique' })
  .transform((d) => [...d].sort((a, b) => a - b));

const base = z.object({
  scheduleName: z.string().trim().min(1).max(100),
  daysOfWeek: daysOfWeekSchema,
  startTime: timeString,
  endTime: timeString,
  description: z.string().trim().max(5000).nullish(),
});

function endAfterStart(v: { startTime?: string; endTime?: string }) {
  if (!v.startTime || !v.endTime) return true;
  return v.endTime > v.startTime;
}

export const createWorkScheduleSchema = base.refine(endAfterStart, {
  message: 'endTime must be after startTime',
  path: ['endTime'],
});
export type CreateWorkScheduleInput = z.infer<typeof createWorkScheduleSchema>;

export const updateWorkScheduleSchema = base
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateWorkScheduleInput = z.infer<typeof updateWorkScheduleSchema>;

export const listWorkSchedulesSchema = paginationSchema;
export type ListWorkSchedulesQuery = z.infer<typeof listWorkSchedulesSchema>;
