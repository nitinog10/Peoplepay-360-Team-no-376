import { z } from 'zod';
import { TimeOffStatus } from '../../generated/prisma/enums';
import { paginationSchema } from '../../lib/http';
import { dateOnly, positiveInt } from '../../lib/validation';

function rangeOk(v: { startDate?: Date; endDate?: Date }) {
  return !v.startDate || !v.endDate || v.endDate.getTime() >= v.startDate.getTime();
}

export const createRequestSchema = z
  .object({
    /** HR may file on behalf of an employee; employees may omit it (defaults to self). */
    employeeId: z.number().int().positive().optional(),
    leaveTypeId: z.number().int().positive(),
    startDate: dateOnly,
    endDate: dateOnly,
    reason: z.string().trim().max(5000).nullish(),
  })
  .refine(rangeOk, { message: 'endDate must be on or after startDate', path: ['endDate'] });
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const updateRequestSchema = z
  .object({
    leaveTypeId: z.number().int().positive().optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    reason: z.string().trim().max(5000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' })
  .refine(rangeOk, { message: 'endDate must be on or after startDate', path: ['endDate'] });
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

export const decisionSchema = z.object({
  comments: z.string().trim().max(5000).nullish(),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const listRequestsSchema = paginationSchema
  .extend({
    employeeId: positiveInt.optional(),
    leaveTypeId: positiveInt.optional(),
    status: z.enum(TimeOffStatus).optional(),
    /** Requests overlapping [from, to]. */
    from: dateOnly.optional(),
    to: dateOnly.optional(),
  })
  .refine((v) => !v.from || !v.to || v.to.getTime() >= v.from.getTime(), { message: 'to must be on or after from', path: ['to'] });
export type ListRequestsQuery = z.infer<typeof listRequestsSchema>;
