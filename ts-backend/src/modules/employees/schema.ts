import { z } from 'zod';
import { EmployeeStatus } from '../../generated/prisma/enums';
import { paginationSchema } from '../../lib/http';
import { dateOnly, positiveInt } from '../../lib/validation';

const base = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.email().max(150).toLowerCase(),
  phone: z.string().trim().max(20).nullish(),
  dateOfBirth: dateOnly.nullish(),
  address: z.string().trim().max(5000).nullish(),
  hireDate: dateOnly,
  terminationDate: dateOnly.nullish(),
  departmentId: z.number().int().positive().nullish(),
  jobTitle: z.string().trim().max(100).nullish(),
  managerId: z.number().int().positive().nullish(),
  status: z.enum(EmployeeStatus).default('ACTIVE'),
});

export const createEmployeeSchema = base;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = base
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const listEmployeesSchema = paginationSchema.extend({
  departmentId: positiveInt.optional(),
  managerId: positiveInt.optional(),
  status: z.enum(EmployeeStatus).optional(),
});
export type ListEmployeesQuery = z.infer<typeof listEmployeesSchema>;

export const terminateEmployeeSchema = z.object({
  terminationDate: dateOnly.optional(),
});
export type TerminateEmployeeInput = z.infer<typeof terminateEmployeeSchema>;

// ---- schedule assignments ----

const assignmentBase = z.object({
  scheduleId: z.number().int().positive(),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly.nullish(),
  /** Close the currently open assignment the day before `effectiveFrom` instead of failing on overlap. */
  closePrevious: z.boolean().default(true),
});

function rangeOk(v: { effectiveFrom?: Date; effectiveTo?: Date | null }) {
  return !v.effectiveFrom || !v.effectiveTo || v.effectiveTo.getTime() >= v.effectiveFrom.getTime();
}

export const createAssignmentSchema = assignmentBase.refine(rangeOk, {
  message: 'effectiveTo must be on or after effectiveFrom',
  path: ['effectiveTo'],
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = assignmentBase
  .omit({ closePrevious: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' })
  .refine(rangeOk, { message: 'effectiveTo must be on or after effectiveFrom', path: ['effectiveTo'] });
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
