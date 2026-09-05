import { z } from 'zod';
import { ContractStatus, ContractType } from '../../generated/prisma/enums';
import { paginationSchema } from '../../lib/http';
import { dateOnly, positiveInt } from '../../lib/validation';

const base = z.object({
  employeeId: z.number().int().positive(),
  contractType: z.enum(ContractType),
  startDate: dateOnly,
  endDate: dateOnly.nullish(),
  baseSalary: z.number().min(0).max(9_999_999_999.99).multipleOf(0.01).nullish(),
  /** ISO-4217 code; defaults to DEFAULT_CURRENCY from the environment. */
  currency: z.string().trim().length(3).toUpperCase().optional(),
  status: z.enum(ContractStatus).default('ACTIVE'),
  documentUrl: z.url().max(2000).nullish(),
});

function rangeOk(v: { startDate?: Date; endDate?: Date | null }) {
  return !v.startDate || !v.endDate || v.endDate.getTime() >= v.startDate.getTime();
}

export const createContractSchema = base.refine(rangeOk, {
  message: 'endDate must be on or after startDate',
  path: ['endDate'],
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = base
  .omit({ employeeId: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' })
  .refine(rangeOk, { message: 'endDate must be on or after startDate', path: ['endDate'] });
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const terminateContractSchema = z.object({
  endDate: dateOnly.optional(),
});
export type TerminateContractInput = z.infer<typeof terminateContractSchema>;

export const listContractsSchema = paginationSchema.extend({
  employeeId: positiveInt.optional(),
  status: z.enum(ContractStatus).optional(),
  contractType: z.enum(ContractType).optional(),
  /** Only contracts covering this date. */
  activeOn: dateOnly.optional(),
});
export type ListContractsQuery = z.infer<typeof listContractsSchema>;
