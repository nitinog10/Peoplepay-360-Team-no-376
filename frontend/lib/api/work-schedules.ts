import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { ListQuery, Paginated, WorkSchedule } from "./types";

export const WORK_SCHEDULE_SORTS = ["scheduleId", "scheduleName", "weeklyHours", "createdAt"] as const;

export interface WorkScheduleBody {
  scheduleName: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  description?: string | null;
}

export const workScheduleKeys = {
  all: ["work-schedules"] as const,
  list: (query: ListQuery) => ["work-schedules", "list", query] as const,
  detail: (id: number) => ["work-schedules", "detail", id] as const,
};

export const workSchedules = {
  list: (query: ListQuery = {}) => queryOptions({
    queryKey: workScheduleKeys.list(query),
    queryFn: ({ signal }) => http.get<Paginated<WorkSchedule>>("/work-schedules", { query, signal }),
  }),
  detail: (id: number) => queryOptions({
    queryKey: workScheduleKeys.detail(id),
    queryFn: ({ signal }) => http.get<WorkSchedule>(`/work-schedules/${id}`, { signal }),
  }),
  create: (body: WorkScheduleBody) => http.post<WorkSchedule>("/work-schedules", body),
  update: (id: number, body: Partial<WorkScheduleBody>) => http.patch<WorkSchedule>(`/work-schedules/${id}`, body),
  remove: (id: number) => http.delete<void>(`/work-schedules/${id}`),
};
