import { z } from 'zod';

/** `:id` route param → positive integer. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function parseId(params: unknown): number {
  return idParamSchema.parse(params).id;
}

/** Shared pagination / sorting query. Modules extend it with their own filters. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().min(1).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function toSkipTake(p: Pick<Pagination, 'page' | 'pageSize'>) {
  return { skip: (p.page - 1) * p.pageSize, take: p.pageSize };
}

/**
 * Build a Prisma orderBy from `sort`/`order`, restricted to an allow-list of
 * sortable columns so clients cannot sort on arbitrary fields.
 */
export function toOrderBy<T extends string>(
  p: Pick<Pagination, 'sort' | 'order'>,
  allowed: readonly T[],
  fallback: T,
): Record<T, 'asc' | 'desc'> {
  const field = (p.sort && (allowed as readonly string[]).includes(p.sort) ? p.sort : fallback) as T;
  return { [field]: p.order } as Record<T, 'asc' | 'desc'>;
}

export function listResponse<T>(data: T[], total: number, p: Pick<Pagination, 'page' | 'pageSize'>) {
  return {
    data,
    meta: {
      page: p.page,
      pageSize: p.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
    },
  };
}

/**
 * JSON replacer used by Express so Prisma Decimal values serialise as numbers
 * instead of strings, and Dates stay ISO strings.
 */
export function jsonReplacer(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function' &&
    (value as { constructor?: { name?: string } }).constructor?.name === 'Decimal'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return value;
}
