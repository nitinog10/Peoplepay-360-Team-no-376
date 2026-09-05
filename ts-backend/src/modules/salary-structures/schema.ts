import { z } from 'zod';
import { paginationSchema } from '../../lib/http';

export const listSalaryStructuresSchema = paginationSchema.extend({
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type ListSalaryStructuresQuery = z.infer<typeof listSalaryStructuresSchema>;
