import { z } from 'zod';
import { paginationSchema } from '../../lib/http';
import { days, positiveInt } from '../../lib/validation';

const year = z.number().int().min(2000).max(2100);

export const createBalanceSchema = z.object({
  employeeId: z.number().int().positive(),
  leaveTypeId: z.number().int().positive(),
  year,
  allocatedDays: days,
  carriedForwardDays: days.default(0),
  usedDays: days.default(0),
});
export type CreateBalanceInput = z.infer<typeof createBalanceSchema>;

export const updateBalanceSchema = z
  .object({
    allocatedDays: days.optional(),
    carriedForwardDays: days.optional(),
    usedDays: days.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateBalanceInput = z.infer<typeof updateBalanceSchema>;

export const listBalancesSchema = paginationSchema.extend({
  employeeId: positiveInt.optional(),
  leaveTypeId: positiveInt.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type ListBalancesQuery = z.infer<typeof listBalancesSchema>;

export const myBalancesSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const initializeYearSchema = z.object({
  year,
  /** Carry last year's remaining days into `carriedForwardDays`. */
  carryForward: z.boolean().default(false),
  /** Restrict to specific employees (defaults to all ACTIVE employees). */
  employeeIds: z.array(z.number().int().positive()).min(1).optional(),
});
export type InitializeYearInput = z.infer<typeof initializeYearSchema>;

export const recomputeSchema = z.object({
  year: year.optional(),
});
export type RecomputeInput = z.infer<typeof recomputeSchema>;
