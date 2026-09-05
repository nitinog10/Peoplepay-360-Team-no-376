import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type {
  Contract,
  ContractStatus,
  ContractType,
  DateString,
  ListQuery,
  Paginated,
} from "./types";

export const CONTRACT_SORTS = [
  "contractId",
  "startDate",
  "endDate",
  "baseSalary",
  "status",
  "createdAt",
] as const;

export type ListContractsQuery = ListQuery & {
  employeeId?: number;
  status?: ContractStatus;
  contractType?: ContractType;
  activeOn?: DateString;
};

export interface ContractBody {
  employeeId: number;
  contractType: ContractType;
  startDate: DateString;
  endDate?: DateString | null;
  baseSalary?: number | null;
  currency?: string;
  status?: ContractStatus;
  documentUrl?: string | null;
}

export type UpdateContractBody = Partial<Omit<ContractBody, "employeeId">>;

export const contractKeys = {
  all: ["contracts"] as const,
  list: (query: ListContractsQuery) => ["contracts", "list", query] as const,
  detail: (id: number) => ["contracts", "detail", id] as const,
};

export const contracts = {
  list: (query: ListContractsQuery = {}) =>
    queryOptions({
      queryKey: contractKeys.list(query),
      queryFn: ({ signal }) =>
        http.get<Paginated<Contract>>("/contracts", { query, signal }),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: contractKeys.detail(id),
      queryFn: ({ signal }) => http.get<Contract>(`/contracts/${id}`, { signal }),
    }),

  create: (body: ContractBody) => http.post<Contract>("/contracts", body),

  update: (id: number, body: UpdateContractBody) =>
    http.patch<Contract>(`/contracts/${id}`, body),

  terminate: (id: number, body: { endDate?: DateString } = {}) =>
    http.post<Contract>(`/contracts/${id}/terminate`, body),
};
