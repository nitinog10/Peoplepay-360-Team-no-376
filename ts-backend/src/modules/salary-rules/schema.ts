import { z } from 'zod';
import { SalaryRuleBase, SalaryRuleCategory, SalaryRuleMethod } from '../../generated/prisma/enums';
import { paginationSchema } from '../../lib/http';

export const listSalaryRulesSchema = paginationSchema.extend({
  structureId: z.coerce.number().int().positive().optional(),
  category: z.enum(SalaryRuleCategory).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

const nullableMoney = z.number().finite().min(0).nullable().optional();
const nullablePercentage = z.number().finite().min(0).max(10_000).nullable().optional();
const nullableFormula = z.string().trim().min(1).max(2_000).nullable().optional();

const ruleFields = z.object({
  salaryStructureId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Use uppercase letters, numbers and underscores')),
  category: z.enum(SalaryRuleCategory),
  sequence: z.number().int().positive(),
  method: z.enum(SalaryRuleMethod),
  fixedAmount: nullableMoney,
  percentage: nullablePercentage,
  percentageBase: z.enum(SalaryRuleBase).nullable().optional(),
  formula: nullableFormula,
  isActive: z.boolean().optional(),
});

function validateMethod(value: z.infer<typeof ruleFields>, ctx: z.RefinementCtx) {
  if (value.method === 'FIXED' && value.fixedAmount === undefined || value.method === 'FIXED' && value.fixedAmount === null) {
    ctx.addIssue({ code: 'custom', path: ['fixedAmount'], message: 'Fixed amount is required' });
  }
  if (value.method === 'PERCENTAGE') {
    if (value.percentage === undefined || value.percentage === null) ctx.addIssue({ code: 'custom', path: ['percentage'], message: 'Percentage is required' });
    if (!value.percentageBase) ctx.addIssue({ code: 'custom', path: ['percentageBase'], message: 'Percentage base is required' });
  }
  if (value.method === 'FORMULA' && !value.formula) ctx.addIssue({ code: 'custom', path: ['formula'], message: 'Formula is required' });
}

export const createSalaryRuleSchema = ruleFields.superRefine(validateMethod);
export const updateSalaryRuleSchema = ruleFields.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export type ListSalaryRulesQuery = z.infer<typeof listSalaryRulesSchema>;
export type CreateSalaryRuleInput = z.infer<typeof createSalaryRuleSchema>;
export type UpdateSalaryRuleInput = z.infer<typeof updateSalaryRuleSchema>;
