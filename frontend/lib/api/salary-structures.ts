import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { ListQuery, Paginated, SalaryStructureDetail, SalaryStructureListItem } from "./types";

export type ListSalaryStructuresQuery = ListQuery & { active?: boolean };
export interface SalaryStructureBody {
  name: string;
  description?: string | null;
  currency: string;
  isActive?: boolean;
}
export interface ReorderSalaryRulesBody {
  rules: Array<{ salaryRuleId: number; sequence: number }>;
}

export const salaryStructureKeys = {
  all: ["salary-structures"] as const,
  list: (query: ListSalaryStructuresQuery) => ["salary-structures", "list", query] as const,
  detail: (id: number) => ["salary-structures", "detail", id] as const,
};

export const salaryStructures = {
  list: (query: ListSalaryStructuresQuery = {}) =>
    queryOptions({
      queryKey: salaryStructureKeys.list(query),
      queryFn: ({ signal }) => http.get<Paginated<SalaryStructureListItem>>("/salary-structures", { query, signal }),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: salaryStructureKeys.detail(id),
      queryFn: ({ signal }) => http.get<SalaryStructureDetail>(`/salary-structures/${id}`, { signal }),
    }),
  create: (body: SalaryStructureBody) => http.post<SalaryStructureDetail>("/salary-structures", body),
  update: (id: number, body: Partial<SalaryStructureBody>) => http.patch<SalaryStructureDetail>(`/salary-structures/${id}`, body),
  reorderRules: (id: number, body: ReorderSalaryRulesBody) => http.post<SalaryStructureDetail>(`/salary-structures/${id}/reorder-rules`, body),
  remove: (id: number) => http.delete<void>(`/salary-structures/${id}`),
};
