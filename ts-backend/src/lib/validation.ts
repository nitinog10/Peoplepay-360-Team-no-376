import { z } from 'zod';
import { parseDateOnly } from './dates';

/** 'YYYY-MM-DD' → Date at UTC midnight. */
export const dateOnly = z.iso.date().transform(parseDateOnly);

/** ISO-8601 instant with offset or Z → Date. */
export const instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

/** Decimal(5,2)-compatible day count. */
export const days = z.number().min(0).max(999.99).multipleOf(0.01);

export const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const positiveInt = z.coerce.number().int().positive();
