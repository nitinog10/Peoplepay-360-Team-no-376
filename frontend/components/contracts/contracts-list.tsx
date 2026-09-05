"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleCheckBigIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ContractFormDialog } from "@/components/contracts/contract-form-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { useListParams } from "@/hooks/use-list-params";
import { api, type Contract, type ContractStatus, type ContractType } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const BASE_FILTERS: readonly FilterDef[] = [
  {
    kind: "select",
    key: "status",
    label: "Status",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "EXPIRED", label: "Expired" },
      { value: "TERMINATED", label: "Terminated" },
    ],
  },
  {
    kind: "select",
    key: "contractType",
    label: "Contract type",
    options: [
      { value: "PERMANENT", label: "Permanent" },
      { value: "FIXED_TERM", label: "Fixed term" },
      { value: "INTERNSHIP", label: "Internship" },
      { value: "CONTRACTOR", label: "Contractor" },
    ],
  },
  { kind: "date", key: "activeOn", label: "Active on" },
];

const COLUMNS: readonly Column<Contract>[] = [
  {
    key: "contractId",
    header: "Contract",
    sortable: true,
    cell: (contract) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">#{contract.contractId}</span>
        {contract.isCurrent && <Badge className="bg-success/10 text-success"><CircleCheckBigIcon /> Current</Badge>}
      </div>
    ),
  },
  { key: "contractType", header: "Type", cell: (contract) => <StatusBadge status={contract.contractType} /> },
  { key: "startDate", header: "Start", sortable: true, cell: (contract) => formatDate(contract.startDate) },
  { key: "endDate", header: "End", sortable: true, cell: (contract) => contract.endDate ? formatDate(contract.endDate) : "Open-ended" },
  { key: "baseSalary", header: "Base salary", sortable: true, align: "end", hideBelow: "md", cell: (contract) => formatCurrency(contract.baseSalary, contract.currency) },
  { key: "status", header: "Status", sortable: true, cell: (contract) => <StatusBadge status={contract.status} /> },
  {
    key: "document",
    header: "Document",
    hideBelow: "lg",
    cell: (contract) => contract.documentUrl ? (
      <Button asChild variant="link" size="sm">
        <Link href={contract.documentUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open <ExternalLinkIcon /></Link>
      </Button>
    ) : "—",
  },
];

function positiveId(value: string | undefined): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export function ContractsList() {
  const router = useRouter();
  const { can } = useCan();
  const editable = can("contracts:write");
  const list = useListParams({ sort: "startDate", order: "desc" });
  const selectedEmployeeId = positiveId(list.filters.employeeId);
  const employees = useQuery({
    ...api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }),
    enabled: editable,
  });
  const query = useQuery({
    ...api.contracts.list({
      ...list.params,
      employeeId: selectedEmployeeId,
      status: list.filters.status as ContractStatus | undefined,
      contractType: list.filters.contractType as ContractType | undefined,
      activeOn: list.filters.activeOn,
    }),
    placeholderData: keepPreviousData,
  });
  const filters: readonly FilterDef[] = editable ? [
    {
      kind: "select",
      key: "employeeId",
      label: "Employee",
      allLabel: "All employees",
      options: (employees.data?.data ?? []).map((employee) => ({ value: String(employee.employeeId), label: employee.fullName })),
    },
    ...BASE_FILTERS,
  ] : BASE_FILTERS;
  const columns: readonly Column<Contract>[] = editable
    ? [{ key: "employee", header: "Employee", cell: (contract) => `${contract.employee.firstName} ${contract.employee.lastName}` }, ...COLUMNS]
    : COLUMNS;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader
        title={editable ? "Contracts" : "My Contracts"}
        description="Current and historical employment contracts. Active rows and the current contract are emphasized."
      >
        {editable && (
          <ContractFormDialog
            defaultEmployeeId={selectedEmployeeId}
            trigger={<Button><PlusIcon /> New contract</Button>}
          />
        )}
      </PageHeader>
      <FilterBar list={list} filters={filters} search={editable} searchPlaceholder="Search employees…" />
      <DataTable
        columns={columns}
        query={query}
        list={list}
        rowKey={(contract) => contract.contractId}
        rowClassName={(contract) => contract.status === "ACTIVE" ? "bg-success/5 hover:bg-success/10" : undefined}
        onRowClick={(contract) => router.push(`/contracts/${contract.contractId}`)}
        caption="Employment contracts"
        empty={{ title: "No contracts", description: "No contracts match the selected filters." }}
      />
    </div>
  );
}
