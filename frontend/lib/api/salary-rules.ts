import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { ListQuery, Paginated, SalaryRuleCategory, SalaryRuleListItem } from "./types";

export type ListSalaryRulesQuery = ListQuery & {
  structureId?: number;
  category?: SalaryRuleCategory;
  active?: boolean;
};

export const salaryRuleKeys = {
  all: ["salary-rules"] as const,
  list: (query: ListSalaryRulesQuery) => ["salary-rules", "list", query] as const,
};

export const salaryRules = {
  list: (query: ListSalaryRulesQuery = {}) =>
    queryOptions({
      queryKey: salaryRuleKeys.list(query),
      queryFn: ({ signal }) => http.get<Paginated<SalaryRuleListItem>>("/salary-rules", { query, signal }),
    }),
};
