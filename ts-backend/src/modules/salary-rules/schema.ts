import { z } from 'zod';
import { SalaryRuleCategory } from '../../generated/prisma/enums';
import { paginationSchema } from '../../lib/http';

export const listSalaryRulesSchema = paginationSchema.extend({
  structureId: z.coerce.number().int().positive().optional(),
  category: z.enum(SalaryRuleCategory).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type ListSalaryRulesQuery = z.infer<typeof listSalaryRulesSchema>;
