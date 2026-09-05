import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { Department, DepartmentBody, ListQuery, Paginated } from "./types";

/** The `toOrderBy` allow-list in `src/modules/departments/service.ts`. */
export const DEPARTMENT_SORTS = ["departmentId", "departmentName"] as const;

/** Field names a form owns, for mapping a 409 back onto an input. */
export const DEPARTMENT_FIELDS = ["departmentName", "description"] as const;

export const departmentKeys = {
  all: ["departments"] as const,
  list: (query: ListQuery) => ["departments", "list", query] as const,
  detail: (id: number) => ["departments", "detail", id] as const,
};

/**
 * `queryOptions()` rather than bare hooks: a screen passes the result straight to
 * `useQuery`, and an invalidation elsewhere can reuse the same key builder.
 */
export const departments = {
  list: (query: ListQuery = {}) =>
    queryOptions({
      queryKey: departmentKeys.list(query),
      queryFn: ({ signal }) =>
        http.get<Paginated<Department>>("/departments", { query, signal }),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: departmentKeys.detail(id),
      queryFn: ({ signal }) => http.get<Department>(`/departments/${id}`, { signal }),
    }),

  create: (body: DepartmentBody) => http.post<Department>("/departments", body),

  update: (id: number, body: Partial<DepartmentBody>) =>
    http.patch<Department>(`/departments/${id}`, body),

  /** 422 BUSINESS_RULE_VIOLATION while the department still has employees. */
  remove: (id: number) => http.delete<void>(`/departments/${id}`),
};
