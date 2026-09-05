import { z } from 'zod';
import { ContractType, PayrunStatus } from '../../generated/prisma/enums';
import { DAY_MS } from '../../lib/dates';
import { paginationSchema } from '../../lib/http';
import { dateOnly } from '../../lib/validation';

const period = {
  from: dateOnly,
  to: dateOnly,
};

function periodIsValid(value: { from: Date; to: Date }, ctx: z.RefinementCtx) {
  if (value.to.getTime() < value.from.getTime()) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must be on or after from' });
  }
  if ((value.to.getTime() - value.from.getTime()) / DAY_MS > 366) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'Pay period cannot exceed 367 calendar days' });
  }
}

export const listPayrunsSchema = paginationSchema.extend({
  status: z.enum(PayrunStatus).optional(),
  structureId: z.coerce.number().int().positive().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});
export type ListPayrunsQuery = z.infer<typeof listPayrunsSchema>;

export const eligibleEmployeesSchema = z
  .object({
    structureId: z.coerce.number().int().positive(),
    ...period,
    contractType: z.enum(ContractType).optional(),
    q: z.string().trim().min(1).optional(),
  })
  .superRefine(periodIsValid);
export type EligibleEmployeesQuery = z.infer<typeof eligibleEmployeesSchema>;

export const createPayrunSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    structureId: z.number().int().positive(),
    periodStart: dateOnly,
    periodEnd: dateOnly,
    employeeIds: z.array(z.number().int().positive()).min(1).max(500),
  })
  .superRefine((value, ctx) => {
    periodIsValid({ from: value.periodStart, to: value.periodEnd }, ctx);
    if (new Set(value.employeeIds).size !== value.employeeIds.length) {
      ctx.addIssue({ code: 'custom', path: ['employeeIds'], message: 'employeeIds must be unique' });
    }
  });
export type CreatePayrunInput = z.infer<typeof createPayrunSchema>;

export const cancelPayrunSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type CancelPayrunInput = z.infer<typeof cancelPayrunSchema>;
