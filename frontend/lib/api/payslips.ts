import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { DateString, ListQuery, Paginated, PayrunStatus, PayslipDetail, PayslipListItem } from "./types";

export type ListPayslipsQuery = ListQuery & {
  employeeId?: number;
  payrunId?: number;
  status?: PayrunStatus;
  from?: DateString;
  to?: DateString;
};

export const payslipKeys = {
  all: ["payslips"] as const,
  list: (query: ListPayslipsQuery) => ["payslips", "list", query] as const,
  detail: (id: number) => ["payslips", "detail", id] as const,
};

export const payslips = {
  list: (query: ListPayslipsQuery = {}) =>
    queryOptions({
      queryKey: payslipKeys.list(query),
      queryFn: ({ signal }) => http.get<Paginated<PayslipListItem>>("/payslips", { query, signal }),
    }),
  detail: (id: number) =>
    queryOptions({
      queryKey: payslipKeys.detail(id),
      queryFn: ({ signal }) => http.get<PayslipDetail>(`/payslips/${id}`, { signal }),
    }),
  recompute: (id: number) => http.post<PayslipDetail>(`/payslips/${id}/recompute`),
  downloadPdf: (id: number) => http.download(`/payslips/${id}/pdf`),
};
