import { z } from 'zod';
import { AttendanceEntryType, AttendanceSource, AttendanceStatus } from '../../generated/prisma/enums';
import { paginationSchema } from '../../lib/http';
import { dateOnly, instant, positiveInt } from '../../lib/validation';

/** Self-service punches come from the web widget or a mobile app. */
export const punchSchema = z.object({
  source: z.enum([AttendanceSource.WEB, AttendanceSource.MOBILE_APP]).default('WEB'),
});
export type PunchInput = z.infer<typeof punchSchema>;

export const listRecordsSchema = paginationSchema
  .extend({
    employeeId: positiveInt.optional(),
    date: dateOnly.optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    status: z.enum(AttendanceStatus).optional(),
  })
  .refine((v) => !v.from || !v.to || v.to.getTime() >= v.from.getTime(), { message: 'to must be on or after from', path: ['to'] });
export type ListRecordsQuery = z.infer<typeof listRecordsSchema>;

export const entryInputSchema = z.object({
  entryType: z.enum(AttendanceEntryType),
  entryTime: instant,
  source: z.enum(AttendanceSource).default('MANUAL'),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const createRecordSchema = z.object({
  employeeId: z.number().int().positive(),
  attendanceDate: dateOnly,
  status: z.enum(AttendanceStatus).default('PRESENT'),
  notes: z.string().trim().max(5000).nullish(),
  entries: z.array(entryInputSchema).max(50).default([]),
});
export type CreateRecordInput = z.infer<typeof createRecordSchema>;

export const updateRecordSchema = z
  .object({
    attendanceDate: dateOnly.optional(),
    status: z.enum(AttendanceStatus).optional(),
    notes: z.string().trim().max(5000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;

export const updateEntrySchema = entryInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export const markAbsencesSchema = z.object({
  date: dateOnly,
});
export type MarkAbsencesInput = z.infer<typeof markAbsencesSchema>;
