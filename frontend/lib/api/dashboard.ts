import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type { ContractType, DateString, PayrollDashboardResponse } from "./types";

export interface PayrollDashboardQuery {
  from: DateString;
  to: DateString;
  departmentId?: number;
  contractType?: ContractType;
}

export const dashboardKeys = {
  all: ["dashboard"] as const,
  payroll: (query: PayrollDashboardQuery) => ["dashboard", "payroll", query] as const,
};

export const dashboard = {
  payroll: (query: PayrollDashboardQuery) => queryOptions({
    queryKey: dashboardKeys.payroll(query),
    queryFn: ({ signal }) => http.get<PayrollDashboardResponse>("/dashboard/payroll", { query: { ...query }, signal }),
    staleTime: 0,
  }),
};
