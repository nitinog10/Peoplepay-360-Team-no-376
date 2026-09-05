"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { SalaryConfigDeleteDialog } from "@/components/payroll/salary-config-delete-dialog";
import { RuleCalculation } from "@/components/payroll/salary-rule-table";
import { SalaryRuleFormDialog } from "@/components/payroll/salary-rule-form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { useListParams } from "@/hooks/use-list-params";
import { api, salaryRuleKeys, salaryStructureKeys, type SalaryRuleCategory, type SalaryRuleListItem } from "@/lib/api";

const CATEGORIES: SalaryRuleCategory[] = ["BASIC", "ALLOWANCE", "GROSS", "DEDUCTION", "NET"];
const COLUMNS: readonly Column<SalaryRuleListItem>[] = [
  { key: "sequence", header: "Order", sortable: true, cell: (rule) => rule.sequence },
  { key: "name", header: "Rule", sortable: true, cell: (rule) => <div><p className="font-medium">{rule.name}</p><p className="font-mono text-xs text-muted-foreground">{rule.code}</p></div> },
  { key: "structure", header: "Structure", cell: (rule) => <Link className="text-primary hover:underline" href={`/payroll/structures/${rule.salaryStructureId}`}>{rule.salaryStructure.name}</Link> },
  { key: "category", header: "Category", sortable: true, cell: (rule) => <StatusBadge status={rule.category} /> },
  { key: "method", header: "Method", cell: (rule) => <StatusBadge status={rule.method} /> },
  { key: "calculation", header: "Calculation", cell: (rule) => <RuleCalculation rule={rule} currency={rule.salaryStructure.currency} /> },
  { key: "isActive", header: "Status", sortable: true, cell: (rule) => <StatusBadge status={rule.isActive ? "ACTIVE" : "INACTIVE"} /> },
];
const optionalBoolean = (value?: string) => value === "true" ? true : value === "false" ? false : undefined;
const positiveInteger = (value?: string) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; };

export function SalaryRulesList({ editable }: { editable: boolean }) {
  const queryClient = useQueryClient();
  const { can } = useCan();
  const mayEdit = editable && can("salary-config:write");
  const list = useListParams({ sort: "sequence", order: "asc" });
  const structures = useQuery(api.salaryStructures.list({ pageSize: 100 }));
  const selectedStructureId = positiveInteger(list.filters.structureId);
  const filters: readonly FilterDef[] = [
    { kind: "select", key: "structureId", label: "Structure", options: (structures.data?.data ?? []).map((structure) => ({ value: String(structure.salaryStructureId), label: structure.name })) },
    { kind: "select", key: "category", label: "Category", options: CATEGORIES.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })) },
    { kind: "select", key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
  ];
  const query = useQuery({ ...api.salaryRules.list({ ...list.params, structureId: selectedStructureId, category: list.filters.category as SalaryRuleCategory | undefined, active: optionalBoolean(list.filters.active) }), placeholderData: keepPreviousData });

  async function removed(rule: SalaryRuleListItem) {
    await api.salaryRules.remove(rule.salaryRuleId);
    queryClient.removeQueries({ queryKey: salaryRuleKeys.detail(rule.salaryRuleId) });
    await Promise.all([queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all }), queryClient.invalidateQueries({ queryKey: salaryStructureKeys.all })]);
    toast.success("Salary rule deleted.");
  }
  async function deactivate(rule: SalaryRuleListItem) {
    await api.salaryRules.update(rule.salaryRuleId, { isActive: false });
    await Promise.all([queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all }), queryClient.invalidateQueries({ queryKey: salaryStructureKeys.all })]);
    toast.success("Salary rule deactivated.");
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8" data-editable={mayEdit}>
      <PageHeader title="Salary rules" description={mayEdit ? "Create and maintain ordered payroll rules across structures." : "Read-only ordered payroll rules across all salary structures."}>
        {mayEdit && <SalaryRuleFormDialog structureId={selectedStructureId ?? structures.data?.data[0]?.salaryStructureId} trigger={<Button disabled={(structures.data?.data.length ?? 0) === 0}><PlusIcon />New rule</Button>} />}
      </PageHeader>
      <FilterBar list={list} filters={filters} searchPlaceholder="Search rule, code, or structure…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(rule) => rule.salaryRuleId}
        rowActions={mayEdit ? (rule) => <div className="flex justify-end gap-1"><SalaryRuleFormDialog rule={rule} trigger={<Button type="button" variant="ghost" size="icon-sm" title="Edit rule"><PencilIcon /><span className="sr-only">Edit</span></Button>} /><SalaryConfigDeleteDialog label={rule.name} active={rule.isActive} onDelete={() => removed(rule)} onDeactivate={() => deactivate(rule)} /></div> : undefined}
        caption="Salary rules"
        empty={{ title: "No salary rules", description: "No rule matches the current search and filters." }}
      />
    </div>
  );
}
