"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useListParams } from "@/hooks/use-list-params";
import { api, type PayrunStatus, type PayslipListItem } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatDays } from "@/lib/format";

const FILTERS: readonly FilterDef[] = [
  { kind: "select", key: "status", label: "Payrun status", options: ["DRAFT", "COMPUTED", "VALIDATED", "PAID", "CANCELLED"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })) },
  { kind: "date", key: "from", label: "Overlaps from" },
  { kind: "date", key: "to", label: "Overlaps to" },
];

const COLUMNS: readonly Column<PayslipListItem>[] = [
  { key: "employee", header: "Employee", cell: (slip) => <div><p className="font-medium">{slip.employee.firstName} {slip.employee.lastName}</p><p className="text-xs text-muted-foreground">{slip.employee.email}</p></div> },
  { key: "payrun", header: "Payrun", cell: (slip) => <div><p>{slip.payrun.name}</p><p className="text-xs text-muted-foreground">{slip.salaryStructure.name}</p></div> },
  { key: "period", header: "Period", cell: (slip) => <span className="whitespace-nowrap">{formatDate(slip.periodStart)} – {formatDate(slip.periodEnd)}</span> },
  { key: "status", header: "Status", cell: (slip) => <StatusBadge status={slip.status} /> },
  { key: "workedDays", header: "Worked", sortable: true, cell: (slip) => formatDays(slip.workedDays) },
  { key: "gross", header: "Gross", sortable: true, align: "end", cell: (slip) => formatCurrency(slip.gross, slip.currency) },
  { key: "net", header: "Net", sortable: true, align: "end", cell: (slip) => <span className="font-medium">{formatCurrency(slip.net, slip.currency)}</span> },
  { key: "computedAt", header: "Computed", sortable: true, cell: (slip) => slip.computedAt ? formatDateTime(slip.computedAt) : <span className="text-muted-foreground">Pending</span> },
];

function positiveInteger(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function PayslipsList() {
  const router = useRouter();
  const list = useListParams({ sort: "payslipId", order: "desc" });
  const query = useQuery({
    ...api.payslips.list({
      ...list.params,
      employeeId: positiveInteger(list.filters.employeeId),
      payrunId: positiveInteger(list.filters.payrunId),
      status: list.filters.status as PayrunStatus | undefined,
      from: list.filters.from,
      to: list.filters.to,
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader title="Payslips" description="Review payroll calculations and open authenticated printable payslips." />
      <FilterBar list={list} filters={FILTERS} searchPlaceholder="Search employee, payrun, or structure…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(slip) => slip.payslipId}
        onRowClick={(slip) => router.push(`/payroll/payslips/${slip.payslipId}`)}
        caption="Payslips"
        empty={{ title: "No payslips", description: "Payslips appear after employees are selected for a payrun." }}
      />
    </div>
  );
}
