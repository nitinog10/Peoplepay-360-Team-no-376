"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, CalendarDaysIcon, CircleDollarSignIcon, FileTextIcon, HeartPulseIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListParams } from "@/hooks/use-list-params";
import { ApiError, api, type ContractType, type PayrollDashboardQuery } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

const CONTRACT_TYPES: ContractType[] = ["PERMANENT", "FIXED_TERM", "INTERNSHIP", "CONTRACTOR"];

function defaultRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}
const DEFAULT_RANGE = defaultRange();
const integer = (value?: string) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; };

function Kpi({ title, value, detail, href, icon }: { title: string; value: React.ReactNode; detail: string; href: string; icon: React.ReactNode }) {
  return <Link href={href} className="rounded-xl outline-none ring-offset-background transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full"><CardContent className="flex items-start justify-between gap-3 pt-5"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><span className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</span></CardContent></Card></Link>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{message}</div>;
}

export function PayrollDashboard() {
  const list = useListParams();
  const departments = useQuery(api.departments.list({ pageSize: 100, sort: "departmentName" }));
  const from = list.filters.from ?? DEFAULT_RANGE.from;
  const to = list.filters.to ?? DEFAULT_RANGE.to;
  const departmentId = integer(list.filters.departmentId);
  const contractType = list.filters.contractType as ContractType | undefined;
  const dashboardQuery: PayrollDashboardQuery = { from, to, ...(departmentId ? { departmentId } : {}), ...(contractType ? { contractType } : {}) };
  const query = useQuery(api.dashboard.payroll(dashboardQuery));

  if (query.isPending) return <div className="mx-auto grid w-full max-w-content gap-4 px-4 py-8"><Skeleton className="h-28" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><Skeleton className="h-80" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Could not load payroll dashboard."}</p></div>;
  const data = query.data;
  const shared = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const payslipHref = `/payroll/payslips?${shared}`;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader title="Payroll dashboard" description="Live payroll, attendance, and time-off signals from one filtered snapshot." />
      <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5"><label className="grid gap-1 text-xs text-muted-foreground">From<Input type="date" value={from} max={to} onChange={(event) => list.setFilter("from", event.target.value)} /></label><label className="grid gap-1 text-xs text-muted-foreground">To<Input type="date" value={to} min={from} onChange={(event) => list.setFilter("to", event.target.value)} /></label><label className="grid gap-1 text-xs text-muted-foreground">Department<Select value={list.filters.departmentId ?? "__all__"} onValueChange={(value) => list.setFilter("departmentId", value === "__all__" ? null : value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All departments</SelectItem>{departments.data?.data.map((department) => <SelectItem key={department.departmentId} value={String(department.departmentId)}>{department.departmentName}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-1 text-xs text-muted-foreground">Employee type<Select value={contractType ?? "__all__"} onValueChange={(value) => list.setFilter("contractType", value === "__all__" ? null : value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All contract types</SelectItem>{CONTRACT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></label><div className="flex items-end"><Button variant="outline" className="w-full" onClick={list.reset}><RotateCcwIcon />Reset</Button></div></CardContent></Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Payroll key performance indicators">
        <Kpi title="Net paid" value={formatCurrency(data.kpis.totalNetPaid, data.currency)} detail="Paid payroll in period" href={`/payroll/payslips?status=PAID&${shared}`} icon={<CircleDollarSignIcon />} />
        <Kpi title="Payslips" value={data.kpis.payslipsGenerated.total} detail={`${data.kpis.payslipsGenerated.paid} paid · ${data.kpis.payslipsGenerated.pending} pending`} href={payslipHref} icon={<FileTextIcon />} />
        <Kpi title="Average salary" value={formatCurrency(data.kpis.averageSalaryPerEmployee, data.currency)} detail="Per computed employee" href={payslipHref} icon={<CircleDollarSignIcon />} />
        <Kpi title="Approved time off" value={`${data.kpis.approvedTimeOffDays} d`} detail="Approved request days" href={`/time-off/requests?status=APPROVED&${shared}`} icon={<CalendarDaysIcon />} />
        <Kpi title="Attendance health" value={`${data.kpis.attendanceHealthPercent}%`} detail="Present, on-time, complete days" href={`/attendance?${shared}`} icon={<HeartPulseIcon />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Salary Cost by Department</CardTitle><CardDescription>Computed net salary for the selected period.</CardDescription></CardHeader><CardContent>{data.salaryCostByDepartment.length === 0 ? <EmptyChart message="No computed payroll in this period." /> : <div className="h-72" aria-label="Salary cost by department chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.salaryCostByDepartment} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(value) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(Number(value))} /><YAxis type="category" dataKey="departmentName" width={100} tick={{ fontSize: 12 }} /><Tooltip formatter={(value) => formatCurrency(Number(value), data.currency)} /><Bar dataKey="amount" name="Net salary" fill="var(--chart-1)" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Monthly Net Salary Trend</CardTitle><CardDescription>Computed net salary grouped by payroll month.</CardDescription></CardHeader><CardContent>{data.monthlyNetTrend.length === 0 ? <EmptyChart message="No monthly payroll trend in this period." /> : <div className="h-72" aria-label="Monthly net salary trend chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthlyNetTrend} margin={{ left: 8, right: 16 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(Number(value))} /><Tooltip formatter={(value) => formatCurrency(Number(value), data.currency)} /><Line type="monotone" dataKey="amount" name="Net salary" stroke="var(--chart-2)" strokeWidth={3} dot={{ fill: "var(--chart-2)" }} /></LineChart></ResponsiveContainer></div>}</CardContent></Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangleIcon className="size-5 text-warning" />Alerts</CardTitle><CardDescription>Records needing payroll review.</CardDescription></CardHeader><CardContent className="space-y-2">{data.alerts.length === 0 ? <p className="text-sm text-muted-foreground">No alerts for these filters.</p> : data.alerts.map((alert, index) => <Link key={`${alert.type}-${alert.href}-${index}`} href={alert.href} className="block rounded-lg border p-3 transition hover:bg-muted/50"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{alert.title}</p><StatusBadge status={alert.severity} /></div><p className="mt-1 text-xs text-muted-foreground">{alert.message}</p></Link>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Attendance overview</CardTitle><CardDescription>{data.attendance.records} attendance records.</CardDescription></CardHeader><CardContent><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Present</dt><dd className="text-xl font-semibold">{data.attendance.present}</dd></div><div><dt className="text-muted-foreground">Late</dt><dd className="text-xl font-semibold">{data.attendance.late}</dd></div><div><dt className="text-muted-foreground">Absent</dt><dd className="text-xl font-semibold">{data.attendance.absent}</dd></div><div><dt className="text-muted-foreground">Overtime</dt><dd className="text-xl font-semibold">{data.attendance.overtimeHours} h</dd></div><div><dt className="text-muted-foreground">Missing checkout</dt><dd className="text-xl font-semibold">{data.attendance.missingCheckouts}</dd></div><div><dt className="text-muted-foreground">Manual entries</dt><dd className="text-xl font-semibold">{data.attendance.manualEdits}</dd></div></dl></CardContent></Card>
        <Card><CardHeader><CardTitle>Time-off overview</CardTitle><CardDescription>Requests overlapping the selected period.</CardDescription></CardHeader><CardContent><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Approved days</dt><dd className="text-xl font-semibold">{data.timeOff.approvedDays}</dd></div><div><dt className="text-muted-foreground">Pending days</dt><dd className="text-xl font-semibold">{data.timeOff.pendingDays}</dd></div><div><dt className="text-muted-foreground">Approved requests</dt><dd className="text-xl font-semibold">{data.timeOff.approvedRequests}</dd></div><div><dt className="text-muted-foreground">Pending requests</dt><dd className="text-xl font-semibold">{data.timeOff.pendingRequests}</dd></div></dl></CardContent></Card>
      </section>

      <Card><CardHeader><CardTitle>Department breakdown</CardTitle><CardDescription>Every row uses the same period, department, and employee-type filters.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Department</TableHead><TableHead className="text-right">Employees</TableHead><TableHead className="text-right">Salary cost</TableHead><TableHead className="text-right">Net paid</TableHead><TableHead className="text-right">Payslips</TableHead><TableHead className="text-right">Attendance health</TableHead><TableHead className="text-right">Approved leave</TableHead></TableRow></TableHeader><TableBody>{data.departmentBreakdown.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No departments match these filters.</TableCell></TableRow> : data.departmentBreakdown.map((row) => <TableRow key={row.departmentId ?? "unassigned"}><TableCell className="font-medium">{row.departmentName}</TableCell><TableCell className="text-right">{row.employees}</TableCell><TableCell className="text-right">{formatCurrency(row.salaryCost, data.currency)}</TableCell><TableCell className="text-right">{formatCurrency(row.netPaid, data.currency)}</TableCell><TableCell className="text-right">{row.payslips}</TableCell><TableCell className="text-right">{row.attendanceHealthPercent}%</TableCell><TableCell className="text-right">{row.approvedTimeOffDays} d</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </div>
  );
}
