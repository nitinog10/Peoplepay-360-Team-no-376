import { z } from 'zod';
import { paginationSchema } from '../../lib/http';

export const listSalaryStructuresSchema = paginationSchema.extend({
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

const structureFields = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5_000).nullable().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  isActive: z.boolean().optional(),
});

export const createSalaryStructureSchema = structureFields;
export const updateSalaryStructureSchema = structureFields.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export const reorderSalaryRulesSchema = z.object({
  rules: z
    .array(z.object({ salaryRuleId: z.number().int().positive(), sequence: z.number().int().positive() }))
    .min(1)
    .superRefine((rules, ctx) => {
      const ids = new Set<number>();
      const sequences = new Set<number>();
      rules.forEach((rule, index) => {
        if (ids.has(rule.salaryRuleId)) ctx.addIssue({ code: 'custom', path: [index, 'salaryRuleId'], message: 'Rule ids must be unique' });
        if (sequences.has(rule.sequence)) ctx.addIssue({ code: 'custom', path: [index, 'sequence'], message: 'Sequences must be unique' });
        ids.add(rule.salaryRuleId);
        sequences.add(rule.sequence);
      });
    }),
});

export type ListSalaryStructuresQuery = z.infer<typeof listSalaryStructuresSchema>;
export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;
export type ReorderSalaryRulesInput = z.infer<typeof reorderSalaryRulesSchema>;
