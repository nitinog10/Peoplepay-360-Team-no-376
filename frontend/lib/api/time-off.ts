import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type {
  DateString,
  ListQuery,
  Paginated,
  TimeOffApproval,
  TimeOffRequest,
  TimeOffStatus,
} from "./types";

export const TIME_OFF_SORTS = [
  "requestedAt",
  "startDate",
  "endDate",
  "status",
  "totalDays",
  "timeOffRequestId",
] as const;

export type ListTimeOffRequestsQuery = ListQuery & {
  employeeId?: number;
  leaveTypeId?: number;
  status?: TimeOffStatus;
  from?: DateString;
  to?: DateString;
};

export interface TimeOffRequestBody {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
  employeeId?: number;
}

export interface DecisionTimeOffBody {
  comments?: string | null;
}

export const timeOffKeys = {
  all: ["time-off"] as const,
  lists: ["time-off", "list"] as const,
  list: (query: ListTimeOffRequestsQuery) => ["time-off", "list", query] as const,
  detail: (id: number) => ["time-off", "detail", id] as const,
  approval: (id: number) => ["time-off", "approval", id] as const,
};

export const timeOff = {
  list: (query: ListTimeOffRequestsQuery = {}) =>
    queryOptions({
      queryKey: timeOffKeys.list(query),
      queryFn: ({ signal }) =>
        http.get<Paginated<TimeOffRequest>>("/time-off/requests", { query, signal }),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: timeOffKeys.detail(id),
      queryFn: ({ signal }) =>
        http.get<TimeOffRequest>(`/time-off/requests/${id}`, { signal }),
    }),

  approval: (id: number) =>
    queryOptions({
      queryKey: timeOffKeys.approval(id),
      queryFn: ({ signal }) =>
        http.get<TimeOffApproval>(`/time-off/requests/${id}/approval`, { signal }),
    }),

  create: (body: TimeOffRequestBody) =>
    http.post<TimeOffRequest>("/time-off/requests", body),

  update: (id: number, body: Partial<TimeOffRequestBody>) =>
    http.patch<TimeOffRequest>(`/time-off/requests/${id}`, body),

  approve: (id: number, body: DecisionTimeOffBody = {}) =>
    http.post<TimeOffRequest>(`/time-off/requests/${id}/approve`, body),

  reject: (id: number, body: DecisionTimeOffBody = {}) =>
    http.post<TimeOffRequest>(`/time-off/requests/${id}/reject`, body),

  cancel: (id: number) =>
    http.post<TimeOffRequest>(`/time-off/requests/${id}/cancel`),
};
