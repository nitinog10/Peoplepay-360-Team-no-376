"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { SalaryConfigDeleteDialog } from "@/components/payroll/salary-config-delete-dialog";
import { SalaryStructureFormDialog } from "@/components/payroll/salary-structure-form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { useListParams } from "@/hooks/use-list-params";
import { api, salaryRuleKeys, salaryStructureKeys, type SalaryStructureListItem } from "@/lib/api";

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
const optionalBoolean = (value?: string) => value === "true" ? true : value === "false" ? false : undefined;

export function SalaryStructuresList({ editable }: { editable: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const mayEdit = editable && can("salary-config:write");
  const list = useListParams({ sort: "name", order: "asc" });
  const query = useQuery({ ...api.salaryStructures.list({ ...list.params, active: optionalBoolean(list.filters.active) }), placeholderData: keepPreviousData });

  async function removed(structure: SalaryStructureListItem) {
    await api.salaryStructures.remove(structure.salaryStructureId);
    queryClient.removeQueries({ queryKey: salaryStructureKeys.detail(structure.salaryStructureId) });
    await Promise.all([queryClient.invalidateQueries({ queryKey: salaryStructureKeys.all }), queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all })]);
    toast.success("Salary structure deleted.");
  }
  async function deactivate(structure: SalaryStructureListItem) {
    await api.salaryStructures.update(structure.salaryStructureId, { isActive: false });
    await Promise.all([queryClient.invalidateQueries({ queryKey: salaryStructureKeys.all }), queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all })]);
    toast.success("Salary structure deactivated.");
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8" data-editable={mayEdit}>
      <PageHeader title="Salary structures" description={mayEdit ? "Configure ordered payroll calculation structures." : "Read-only salary configurations used to calculate payroll."}>
        {mayEdit && <SalaryStructureFormDialog trigger={<Button><PlusIcon />New structure</Button>} />}
      </PageHeader>
      <FilterBar list={list} filters={FILTERS} searchPlaceholder="Search name or description…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(structure) => structure.salaryStructureId}
        onRowClick={(structure) => router.push(`/payroll/structures/${structure.salaryStructureId}`)}
        rowActions={mayEdit ? (structure) => <div className="flex justify-end gap-1"><SalaryStructureFormDialog structure={structure} trigger={<Button type="button" variant="ghost" size="icon-sm" title="Edit structure"><PencilIcon /><span className="sr-only">Edit</span></Button>} /><SalaryConfigDeleteDialog label={structure.name} active={structure.isActive} onDelete={() => removed(structure)} onDeactivate={() => deactivate(structure)} /></div> : undefined}
        caption="Salary structures"
        empty={{ title: "No salary structures", description: "No salary configuration matches the current filters." }}
      />
    </div>
  );
}
