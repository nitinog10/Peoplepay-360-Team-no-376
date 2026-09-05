import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { LeaveBalance, ListQuery, Paginated } from "./types";

export interface MyBalancesResponse { year: number; data: LeaveBalance[]; }
export type ListBalancesQuery = ListQuery & { employeeId?: number; leaveTypeId?: number; year?: number };
export interface CreateBalanceBody { employeeId: number; leaveTypeId: number; year: number; allocatedDays: number; carriedForwardDays?: number; usedDays?: number; }
export interface UpdateBalanceBody { allocatedDays?: number; carriedForwardDays?: number; usedDays?: number; }
export interface InitializeYearBody { year: number; carryForward?: boolean; employeeIds?: number[]; }
export interface InitializeYearResult { year: number; employees: number; leaveTypes: number; created: number; skipped: number; }
export interface RecomputeResult { checked: number; corrected: number; corrections: { leaveBalanceId: number; from: number; to: number }[]; }

export const leaveBalanceKeys = {
  all: ["leave-balances"] as const,
  lists: ["leave-balances", "list"] as const,
  list: (query: ListBalancesQuery) => ["leave-balances", "list", query] as const,
  detail: (id: number) => ["leave-balances", "detail", id] as const,
  me: (year?: number) => ["leave-balances", "me", year ?? "current"] as const,
};

export const leaveBalances = {
  list: (query: ListBalancesQuery = {}) => queryOptions({ queryKey: leaveBalanceKeys.list(query), queryFn: ({ signal }) => http.get<Paginated<LeaveBalance>>("/leave-balances", { query, signal }) }),
  detail: (id: number) => queryOptions({ queryKey: leaveBalanceKeys.detail(id), queryFn: ({ signal }) => http.get<LeaveBalance>(`/leave-balances/${id}`, { signal }) }),
  me: (year?: number) => queryOptions({ queryKey: leaveBalanceKeys.me(year), queryFn: ({ signal }) => http.get<MyBalancesResponse>("/leave-balances/me", { query: { year }, signal }) }),
  create: (body: CreateBalanceBody) => http.post<LeaveBalance>("/leave-balances", body),
  update: (id: number, body: UpdateBalanceBody) => http.patch<LeaveBalance>(`/leave-balances/${id}`, body),
  remove: (id: number) => http.delete<void>(`/leave-balances/${id}`),
  initialize: (body: InitializeYearBody) => http.post<InitializeYearResult>("/leave-balances/initialize", body),
  recompute: (body: { year?: number } = {}) => http.post<RecomputeResult>("/leave-balances/recompute", body),
};
