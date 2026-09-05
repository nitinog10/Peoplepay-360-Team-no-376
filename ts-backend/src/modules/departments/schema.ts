import { z } from 'zod';
import { paginationSchema } from '../../lib/http';

export const createDepartmentSchema = z.object({
  departmentName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(5000).nullish(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const listDepartmentsSchema = paginationSchema;
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsSchema>;
