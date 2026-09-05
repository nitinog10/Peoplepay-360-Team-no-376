import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type {
  ListQuery,
  Paginated,
  SalaryRuleBase,
  SalaryRuleCategory,
  SalaryRuleListItem,
  SalaryRuleMethod,
} from "./types";

export type ListSalaryRulesQuery = ListQuery & {
  structureId?: number;
  category?: SalaryRuleCategory;
  active?: boolean;
};

export interface SalaryRuleBody {
  salaryStructureId: number;
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  fixedAmount?: number | null;
  percentage?: number | null;
  percentageBase?: SalaryRuleBase | null;
  formula?: string | null;
  isActive?: boolean;
}

export const salaryRuleKeys = {
  all: ["salary-rules"] as const,
  list: (query: ListSalaryRulesQuery) => ["salary-rules", "list", query] as const,
  detail: (id: number) => ["salary-rules", "detail", id] as const,
};

export const salaryRules = {
  list: (query: ListSalaryRulesQuery = {}) =>
    queryOptions({
      queryKey: salaryRuleKeys.list(query),
      queryFn: ({ signal }) => http.get<Paginated<SalaryRuleListItem>>("/salary-rules", { query, signal }),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: salaryRuleKeys.detail(id),
      queryFn: ({ signal }) => http.get<SalaryRuleListItem>(`/salary-rules/${id}`, { signal }),
    }),
  create: (body: SalaryRuleBody) => http.post<SalaryRuleListItem>("/salary-rules", body),
  update: (id: number, body: Partial<SalaryRuleBody>) => http.patch<SalaryRuleListItem>(`/salary-rules/${id}`, body),
  remove: (id: number) => http.delete<void>(`/salary-rules/${id}`),
};
