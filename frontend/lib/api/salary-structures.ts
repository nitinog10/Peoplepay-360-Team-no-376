import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { ListQuery, Paginated, SalaryStructureDetail, SalaryStructureListItem } from "./types";

export type ListSalaryStructuresQuery = ListQuery & { active?: boolean };

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
};
