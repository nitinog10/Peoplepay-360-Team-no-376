import { z } from 'zod';

export const loginSchema = z.object({
  /** Username or work email. */
  username: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
