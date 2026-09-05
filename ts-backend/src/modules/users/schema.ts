import { z } from 'zod';
import { ASSIGNABLE_ROLE_NAMES } from '../../auth/permissions';
import { paginationSchema } from '../../lib/http';

const username = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9._@-]+$/, 'Username may contain letters, numbers, dots, underscores, @ and dashes');

const password = z.string().min(8).max(200);
const assignableRole = z.enum(ASSIGNABLE_ROLE_NAMES);

export const createUserSchema = z.object({
  employeeId: z.number().int().positive(),
  username,
  password,
  role: assignableRole,
  isActive: z.boolean().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    username: username.optional(),
    password: password.optional(),
    role: assignableRole.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersSchema = paginationSchema.extend({
  role: assignableRole.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
