"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useListParams } from "@/hooks/use-list-params";
import { api, type SalaryStructureListItem } from "@/lib/api";

const FILTERS: readonly FilterDef[] = [
  { kind: "select", key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
];

const COLUMNS: readonly Column<SalaryStructureListItem>[] = [
  { key: "name", header: "Structure", sortable: true, cell: (structure) => <div><p className="font-medium">{structure.name}</p><p className="max-w-lg truncate text-xs text-muted-foreground">{structure.description ?? "No description"}</p></div> },
  { key: "currency", header: "Currency", sortable: true, cell: (structure) => structure.currency },
  { key: "rules", header: "Rules", align: "end", cell: (structure) => structure.ruleCount },
  { key: "payruns", header: "Payruns", align: "end", cell: (structure) => structure.payrunCount },
  { key: "isActive", header: "Status", sortable: true, cell: (structure) => <StatusBadge status={structure.isActive ? "ACTIVE" : "INACTIVE"} /> },
];

function optionalBoolean(value?: string) {
  return value === "true" ? true : value === "false" ? false : undefined;
}

export function SalaryStructuresList({ editable }: { editable: boolean }) {
  const router = useRouter();
  const list = useListParams({ sort: "name", order: "asc" });
  const query = useQuery({ ...api.salaryStructures.list({ ...list.params, active: optionalBoolean(list.filters.active) }), placeholderData: keepPreviousData });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8" data-editable={editable}>
      <PageHeader title="Salary structures" description="Read-only salary configurations used to calculate payroll." />
      <FilterBar list={list} filters={FILTERS} searchPlaceholder="Search name or description…" />
      <DataTable columns={COLUMNS} query={query} list={list} rowKey={(structure) => structure.salaryStructureId} onRowClick={(structure) => router.push(`/payroll/structures/${structure.salaryStructureId}`)} caption="Salary structures" empty={{ title: "No salary structures", description: "No salary configuration matches the current filters." }} />
    </div>
  );
}
