import { z } from 'zod';
import { paginationSchema } from '../../lib/http';

const days = z.number().min(0).max(999.99).multipleOf(0.01);

export const createLeaveTypeSchema = z.object({
  typeName: z.string().trim().min(1).max(50),
  /** Days granted per year by default. 0 means the type is not balance-tracked (e.g. Unpaid). */
  defaultAnnualDays: days.default(0),
  description: z.string().trim().max(5000).nullish(),
});
export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;

export const updateLeaveTypeSchema = createLeaveTypeSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;

export const listLeaveTypesSchema = paginationSchema;
export type ListLeaveTypesQuery = z.infer<typeof listLeaveTypesSchema>;
