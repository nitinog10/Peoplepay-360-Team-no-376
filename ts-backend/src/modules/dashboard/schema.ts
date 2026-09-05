import { z } from 'zod';
import { ContractType } from '../../generated/prisma/enums';
import { parseDateOnly } from '../../lib/dates';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .transform((value, ctx) => {
    try {
      return parseDateOnly(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Use a valid calendar date' });
      return z.NEVER;
    }
  });

export const payrollDashboardSchema = z
  .object({
    from: dateOnly,
    to: dateOnly,
    departmentId: z.coerce.number().int().positive().optional(),
    contractType: z.enum(ContractType).optional(),
  })
  .refine((value) => value.to.getTime() >= value.from.getTime(), {
    path: ['to'],
    message: 'to must be on or after from',
  });

export type PayrollDashboardQuery = z.infer<typeof payrollDashboardSchema>;
