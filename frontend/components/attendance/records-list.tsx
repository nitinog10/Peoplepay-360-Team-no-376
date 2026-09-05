"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarCheckIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { MarkAbsencesDialog } from "@/components/attendance/mark-absences-dialog";
import { AttendanceRecordDialog } from "@/components/attendance/record-form-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/use-can";
import { useListParams } from "@/hooks/use-list-params";
import { api, type AttendanceRecord, type AttendanceStatus } from "@/lib/api";
import { formatDate, formatHours, formatMinutes, formatTime, todayDateOnly } from "@/lib/format";

const BASE_FILTERS: readonly FilterDef[] = [
  { kind: "select", key: "status", label: "Status", options: [
    { value: "PRESENT", label: "Present" }, { value: "ABSENT", label: "Absent" }, { value: "HALF_DAY", label: "Half day" }, { value: "ON_LEAVE", label: "On leave" }, { value: "HOLIDAY", label: "Holiday" }, { value: "WEEK_OFF", label: "Week off" },
  ] },
  { kind: "date", key: "from", label: "From" },
  { kind: "date", key: "to", label: "To" },
];

const BASE_COLUMNS: readonly Column<AttendanceRecord>[] = [
  { key: "attendanceDate", header: "Date", sortable: true, cell: (record) => <span className="font-medium">{formatDate(record.attendanceDate)}</span> },
  { key: "firstIn", header: "First in", cell: (record) => record.derived.firstClockIn ? formatTime(record.derived.firstClockIn) : "—" },
  { key: "lastOut", header: "Last out", cell: (record) => record.derived.lastClockOut ? formatTime(record.derived.lastClockOut) : "—" },
  { key: "worked", header: "Worked", align: "end", cell: (record) => formatHours(record.derived.workedHours) },
  { key: "break", header: "Break", align: "end", hideBelow: "md", cell: (record) => formatHours(record.derived.breakHours) },
  { key: "expected", header: "Expected", align: "end", hideBelow: "lg", cell: (record) => record.derived.expectedHours === null ? "—" : formatHours(record.derived.expectedHours) },
  { key: "overtime", header: "Overtime", align: "end", hideBelow: "lg", cell: (record) => formatHours(record.derived.overtimeHours) },
  { key: "status", header: "Status", sortable: true, cell: (record) => <StatusBadge status={record.status} /> },
  { key: "flags", header: "Flags", hideBelow: "md", cell: (record) => <div className="flex flex-wrap gap-1">{record.derived.isLate && <Badge variant="outline">Late {formatMinutes(record.derived.lateByMinutes)}</Badge>}{record.derived.missingCheckout && <Badge variant="destructive">Missing checkout</Badge>}{!record.derived.isValidSequence && <Badge variant="destructive">Invalid sequence</Badge>}{!record.derived.isLate && !record.derived.missingCheckout && record.derived.isValidSequence && "—"}</div> },
];

function positiveId(value: string | undefined): number | undefined { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : undefined; }

export function AttendanceRecordsList() {
  const router = useRouter(); const { can } = useCan(); const canWrite = can("attendance:write"); const list = useListParams({ sort: "attendanceDate", order: "desc" }); const selectedEmployeeId = positiveId(list.filters.employeeId);
  const employees = useQuery({ ...api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }), enabled: canWrite });
  const query = useQuery({ ...api.attendance.list({ ...list.params, employeeId: selectedEmployeeId, status: list.filters.status as AttendanceStatus | undefined, from: list.filters.from, to: list.filters.to }), placeholderData: keepPreviousData });
  const filters: readonly FilterDef[] = canWrite ? [{ kind: "select", key: "employeeId", label: "Employee", allLabel: "All employees", options: (employees.data?.data ?? []).map((employee) => ({ value: String(employee.employeeId), label: employee.fullName })) }, ...BASE_FILTERS] : BASE_FILTERS;
  const columns: readonly Column<AttendanceRecord>[] = canWrite ? [{ key: "employeeId", header: "Employee", sortable: true, cell: (record) => `${record.employee.firstName} ${record.employee.lastName}` }, ...BASE_COLUMNS] : BASE_COLUMNS;
  const showToday = () => { const today = todayDateOnly(); list.setFilters({ from: today, to: today }); };

  return <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8"><PageHeader title={canWrite ? "Attendance" : "My Attendance"} description="Worked, break, expected and overtime hours are derived from the recorded punches.">{canWrite && <><AttendanceRecordDialog defaultEmployeeId={selectedEmployeeId} trigger={<Button><PlusIcon /> New record</Button>} /><MarkAbsencesDialog /></>}</PageHeader><FilterBar list={list} filters={filters} search={canWrite} searchPlaceholder="Search employees…"><Button variant="outline" onClick={showToday}><CalendarCheckIcon /> Today</Button></FilterBar><DataTable columns={columns} query={query} list={list} rowKey={(record) => record.attendanceRecordId} onRowClick={(record) => router.push(`/attendance/${record.attendanceRecordId}`)} caption="Attendance records" empty={{ title: "No attendance records", description: "Try another date range or status." }} /></div>;
}
