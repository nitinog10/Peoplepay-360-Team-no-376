"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { RuleCalculation } from "@/components/payroll/salary-rule-table";
import { StatusBadge } from "@/components/status-badge";
import { useListParams } from "@/hooks/use-list-params";
import { api, type SalaryRuleCategory, type SalaryRuleListItem } from "@/lib/api";

const CATEGORIES: SalaryRuleCategory[] = ["BASIC", "ALLOWANCE", "GROSS", "DEDUCTION", "NET"];
const FILTERS: readonly FilterDef[] = [
  { kind: "select", key: "category", label: "Category", options: CATEGORIES.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })) },
  { kind: "select", key: "active", label: "Status", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
];

const COLUMNS: readonly Column<SalaryRuleListItem>[] = [
  { key: "sequence", header: "Order", sortable: true, cell: (rule) => rule.sequence },
  { key: "name", header: "Rule", sortable: true, cell: (rule) => <div><p className="font-medium">{rule.name}</p><p className="font-mono text-xs text-muted-foreground">{rule.code}</p></div> },
  { key: "structure", header: "Structure", cell: (rule) => <Link className="text-primary hover:underline" href={`/payroll/structures/${rule.salaryStructureId}`}>{rule.salaryStructure.name}</Link> },
  { key: "category", header: "Category", sortable: true, cell: (rule) => <StatusBadge status={rule.category} /> },
  { key: "method", header: "Method", cell: (rule) => <StatusBadge status={rule.method} /> },
  { key: "calculation", header: "Calculation", cell: (rule) => <RuleCalculation rule={rule} currency={rule.salaryStructure.currency} /> },
  { key: "isActive", header: "Status", sortable: true, cell: (rule) => <StatusBadge status={rule.isActive ? "ACTIVE" : "INACTIVE"} /> },
];

function optionalBoolean(value?: string) {
  return value === "true" ? true : value === "false" ? false : undefined;
}

function positiveInteger(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function SalaryRulesList({ editable }: { editable: boolean }) {
  const list = useListParams({ sort: "sequence", order: "asc" });
  const query = useQuery({
    ...api.salaryRules.list({
      ...list.params,
      structureId: positiveInteger(list.filters.structureId),
      category: list.filters.category as SalaryRuleCategory | undefined,
      active: optionalBoolean(list.filters.active),
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8" data-editable={editable}>
      <PageHeader title="Salary rules" description="Read-only ordered payroll rules across all salary structures." />
      <FilterBar list={list} filters={FILTERS} searchPlaceholder="Search rule, code, or structure…" />
      <DataTable columns={COLUMNS} query={query} list={list} rowKey={(rule) => rule.salaryRuleId} caption="Salary rules" empty={{ title: "No salary rules", description: "No rule matches the current search and filters." }} />
    </div>
  );
}
