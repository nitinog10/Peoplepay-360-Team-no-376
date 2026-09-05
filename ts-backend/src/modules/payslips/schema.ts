import { z } from 'zod';
import { PayrunStatus } from '../../generated/prisma/enums';
import { paginationSchema } from '../../lib/http';
import { dateOnly } from '../../lib/validation';

export const listPayslipsSchema = paginationSchema.extend({
  employeeId: z.coerce.number().int().positive().optional(),
  payrunId: z.coerce.number().int().positive().optional(),
  status: z.enum(PayrunStatus).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export type ListPayslipsQuery = z.infer<typeof listPayslipsSchema>;
