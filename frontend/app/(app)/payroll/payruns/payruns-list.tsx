"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { NewPayrunWizard } from "@/components/payroll/new-payrun-wizard";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCan } from "@/hooks/use-can";
import { useListParams } from "@/hooks/use-list-params";
import { api, type PayrunListItem, type PayrunStatus } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

const FILTERS: readonly FilterDef[] = [
  { kind: "select", key: "status", label: "Status", options: ["DRAFT", "COMPUTED", "VALIDATED", "PAID", "CANCELLED"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })) },
  { kind: "date", key: "from", label: "Overlaps from" },
  { kind: "date", key: "to", label: "Overlaps to" },
];

const COLUMNS: readonly Column<PayrunListItem>[] = [
  { key: "name", header: "Payrun", sortable: true, cell: (run) => <div><p className="font-medium">{run.name}</p><p className="text-xs text-muted-foreground">{run.salaryStructure.name}</p></div> },
  { key: "periodStart", header: "Period", sortable: true, cell: (run) => <span className="whitespace-nowrap">{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</span> },
  { key: "status", header: "Status", sortable: true, cell: (run) => <StatusBadge status={run.status} /> },
  { key: "payslips", header: "Payslips", align: "end", cell: (run) => run.payslipCount },
  { key: "net", header: "Net", align: "end", cell: (run) => formatCurrency(run.totals.net, run.currency) },
];

export function PayrunsList() {
  const router = useRouter();
  const { can } = useCan();
  const list = useListParams({ sort: "periodStart", order: "desc" });
  const query = useQuery({
    ...api.payruns.list({
      ...list.params,
      status: list.filters.status as PayrunStatus | undefined,
      from: list.filters.from,
      to: list.filters.to,
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader title="Payruns" description="Build employee batches, calculate salaries, validate, pay, and distribute payslips.">
        {can("payruns:write") && <NewPayrunWizard />}
      </PageHeader>
      <FilterBar list={list} filters={FILTERS} searchPlaceholder="Search payrun or structure…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(run) => run.payrunId}
        onRowClick={(run) => router.push(`/payroll/payruns/${run.payrunId}`)}
        caption="Payroll runs"
        empty={{ title: "No payruns", description: "Create a payrun to start a payroll batch." }}
      />
    </div>
  );
}
