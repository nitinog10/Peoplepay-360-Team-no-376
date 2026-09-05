import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type {
  ContractType,
  DateString,
  EligibilityResponse,
  ListQuery,
  Paginated,
  PayrunDetail,
  PayrunListItem,
  PayrunStatus,
  PayrunWarnings,
  SendPayslipsResult,
} from "./types";

export type ListPayrunsQuery = ListQuery & {
  status?: PayrunStatus;
  structureId?: number;
  from?: DateString;
  to?: DateString;
};

export interface EligibilityQuery {
  structureId: number;
  from: DateString;
  to: DateString;
  contractType?: ContractType;
  q?: string;
}

export interface CreatePayrunBody {
  name: string;
  structureId: number;
  periodStart: DateString;
  periodEnd: DateString;
  employeeIds: number[];
}

export const payrunKeys = {
  all: ["payruns"] as const,
  list: (query: ListPayrunsQuery) => ["payruns", "list", query] as const,
  detail: (id: number) => ["payruns", "detail", id] as const,
  warnings: (id: number) => ["payruns", "warnings", id] as const,
  eligibility: (query: EligibilityQuery) => ["payruns", "eligibility", query] as const,
};

export const payruns = {
  list: (query: ListPayrunsQuery = {}) =>
    queryOptions({
      queryKey: payrunKeys.list(query),
      queryFn: ({ signal }) => http.get<Paginated<PayrunListItem>>("/payruns", { query, signal }),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: payrunKeys.detail(id),
      queryFn: ({ signal }) => http.get<PayrunDetail>(`/payruns/${id}`, { signal }),
    }),
  warnings: (id: number) =>
    queryOptions({
      queryKey: payrunKeys.warnings(id),
      queryFn: ({ signal }) => http.get<PayrunWarnings>(`/payruns/${id}/warnings`, { signal }),
    }),
  eligibility: (query: EligibilityQuery) =>
    queryOptions({
      queryKey: payrunKeys.eligibility(query),
      queryFn: ({ signal }) => http.get<EligibilityResponse>("/payruns/eligible-employees", { query: { ...query }, signal }),
    }),
  create: (body: CreatePayrunBody) => http.post<PayrunDetail>("/payruns", body),
  compute: (id: number) => http.post<PayrunDetail>(`/payruns/${id}/compute`),
  validate: (id: number) => http.post<PayrunDetail>(`/payruns/${id}/validate`),
  markPaid: (id: number) => http.post<PayrunDetail>(`/payruns/${id}/mark-paid`),
  cancel: (id: number, reason: string) => http.post<PayrunDetail>(`/payruns/${id}/cancel`, { reason }),
  sendPayslips: (id: number) => http.post<SendPayslipsResult>(`/payruns/${id}/send-payslips`),
};
