import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { LeaveType, ListQuery, Paginated } from "./types";

export interface LeaveTypeBody {
  typeName: string;
  defaultAnnualDays: number;
  description?: string | null;
}

export const leaveTypeKeys = {
  all: ["leave-types"] as const,
  list: (query: ListQuery) => ["leave-types", "list", query] as const,
  detail: (id: number) => ["leave-types", "detail", id] as const,
};

export const leaveTypes = {
  list: (query: ListQuery = {}) =>
    queryOptions({
      queryKey: leaveTypeKeys.list(query),
      queryFn: ({ signal }) =>
        http.get<Paginated<LeaveType>>("/leave-types", { query, signal }),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: leaveTypeKeys.detail(id),
      queryFn: ({ signal }) => http.get<LeaveType>(`/leave-types/${id}`, { signal }),
    }),

  create: (body: LeaveTypeBody) => http.post<LeaveType>("/leave-types", body),

  update: (id: number, body: Partial<LeaveTypeBody>) =>
    http.patch<LeaveType>(`/leave-types/${id}`, body),

  remove: (id: number) => http.delete<void>(`/leave-types/${id}`),
};
