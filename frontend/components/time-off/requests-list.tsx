"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CancelRequestButton, DecisionRequestButton } from "@/components/time-off/request-actions";
import { RequestTimeOffDialog } from "@/components/time-off/request-form-dialog";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { useListParams } from "@/hooks/use-list-params";
import { api, type TimeOffRequest, type TimeOffStatus } from "@/lib/api";
import { formatDate, formatDays } from "@/lib/format";

const BASE_FILTERS: readonly FilterDef[] = [
  { kind: "select", key: "status", label: "Status", options: [{ value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }, { value: "CANCELLED", label: "Cancelled" }] },
  { kind: "date", key: "from", label: "From" }, { kind: "date", key: "to", label: "To" },
];
const COLUMNS: readonly Column<TimeOffRequest>[] = [
  { key: "leaveType", header: "Type", cell: (request) => <span className="font-medium">{request.leaveType.typeName}</span> },
  { key: "startDate", header: "Start", sortable: true, cell: (request) => formatDate(request.startDate) },
  { key: "endDate", header: "End", sortable: true, cell: (request) => formatDate(request.endDate) },
  { key: "totalDays", header: "Days", sortable: true, align: "end", cell: (request) => formatDays(request.totalDays) },
  { key: "reason", header: "Reason", hideBelow: "md", cell: (request) => request.reason ?? "—" },
  { key: "status", header: "Status", sortable: true, cell: (request) => <StatusBadge status={request.status} /> },
];
function positiveId(value: string | undefined): number | undefined { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : undefined; }

export function TimeOffRequestsList() {
  const router = useRouter(); const { can } = useCan(); const canDecide = can("time-off:decide"); const list = useListParams({ sort: "requestedAt", order: "desc" }); const selectedEmployeeId = canDecide ? positiveId(list.filters.employeeId) : undefined;
  const employees = useQuery({ ...api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }), enabled: canDecide });
  const query = useQuery({ ...api.timeOff.list({ ...list.params, employeeId: selectedEmployeeId, status: list.filters.status as TimeOffStatus | undefined, from: list.filters.from, to: list.filters.to }), placeholderData: keepPreviousData });
  const filters: readonly FilterDef[] = canDecide ? [{ kind: "select", key: "employeeId", label: "Employee", allLabel: "All employees", options: (employees.data?.data ?? []).map((employee) => ({ value: String(employee.employeeId), label: employee.fullName })) }, ...BASE_FILTERS] : BASE_FILTERS;
  const columns: readonly Column<TimeOffRequest>[] = canDecide ? [{ key: "employee", header: "Employee", cell: (request) => `${request.employee.firstName} ${request.employee.lastName}` }, ...COLUMNS] : COLUMNS;

  return <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8"><PageHeader title={canDecide ? "Time-Off Requests" : "My Time-Off Requests"} description={canDecide ? "Review employee requests and manage approved leave." : "Create and manage your time-off requests."}>{!canDecide && <RequestTimeOffDialog />}</PageHeader><FilterBar list={list} filters={filters} search searchPlaceholder={canDecide ? "Employee, email or reason…" : "Search reasons…"} /><DataTable columns={columns} query={query} list={list} rowKey={(request) => request.timeOffRequestId} onRowClick={(request) => router.push(`/time-off/requests/${request.timeOffRequestId}`)} rowActions={(request) => {
    if (canDecide && request.status === "PENDING") return <div className="flex items-center justify-end gap-1"><DecisionRequestButton request={request} decision="APPROVED" /><DecisionRequestButton request={request} decision="REJECTED" /><CancelRequestButton request={request} /></div>;
    if (canDecide && request.status === "APPROVED") return <CancelRequestButton request={request} />;
    if (!canDecide && request.status === "PENDING") return <div className="flex items-center justify-end gap-1"><RequestTimeOffDialog request={request} trigger={<Button variant="outline" size="sm"><PencilIcon /> Edit</Button>} /><CancelRequestButton request={request} /></div>;
    return null;
  }} caption="Time-off requests" empty={{ title: "No time-off requests", description: "Change the active filters or submit a request." }} /></div>;
}
