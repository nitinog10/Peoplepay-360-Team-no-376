"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ClockAlertIcon, PencilIcon, TimerIcon } from "lucide-react";
import Link from "next/link";

import { AttendanceEntryDialog, DeleteAttendanceEntry } from "@/components/attendance/entry-form-dialog";
import { AttendanceRecordDialog, DeleteAttendanceRecord } from "@/components/attendance/record-form-dialog";
import { Forbidden, isForbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusLabel } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatHours, formatMinutes } from "@/lib/format";

function Metric({ label, value }: { label: string; value: string }) { return <Card size="sm"><CardContent><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></CardContent></Card>; }

export function AttendanceRecordDetail({ recordId }: { recordId: number }) {
  const { can } = useCan(); const canWrite = can("attendance:write"); const query = useQuery(api.attendance.detail(recordId));
  if (isForbidden(query.error)) return <Forbidden title="This attendance record is not yours" description="Employee attendance is private. You can only open records attached to your own employee profile." />;
  if (query.isPending) return <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Could not load the attendance record."}</p></div>;
  const record = query.data; const derived = record.derived;

  return <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8"><Button asChild variant="ghost" className="w-fit"><Link href="/attendance"><ArrowLeftIcon /> Back to attendance</Link></Button><PageHeader title={formatDate(record.attendanceDate)} description={`${record.employee.firstName} ${record.employee.lastName}${derived.scheduleName ? ` · ${derived.scheduleName}` : ""}`}><StatusBadge status={record.status} />{canWrite && <><AttendanceRecordDialog record={record} trigger={<Button type="button" variant="outline"><PencilIcon /> Edit record</Button>} /><DeleteAttendanceRecord record={record} /></>}</PageHeader><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Worked" value={formatHours(derived.workedHours)} /><Metric label="Break" value={formatHours(derived.breakHours)} /><Metric label="Expected" value={derived.expectedHours === null ? "—" : formatHours(derived.expectedHours)} /><Metric label="Overtime" value={formatHours(derived.overtimeHours)} /></section>{(derived.isLate || derived.missingCheckout || derived.sequenceError) && <div className="flex flex-wrap gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">{derived.isLate && <Badge variant="outline"><TimerIcon /> Late by {formatMinutes(derived.lateByMinutes)}</Badge>}{derived.missingCheckout && <Badge variant="destructive"><ClockAlertIcon /> Missing checkout</Badge>}{derived.sequenceError && <p className="text-destructive">{derived.sequenceError}</p>}</div>}<Card><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle>Punches</CardTitle>{canWrite && <AttendanceEntryDialog record={record} />}</CardHeader><CardContent><div className="rounded-xl ring-1 ring-foreground/10"><Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Time</TableHead><TableHead>Source</TableHead>{canWrite && <TableHead><span className="sr-only">Actions</span></TableHead>}</TableRow></TableHeader><TableBody>{record.entries.length > 0 ? record.entries.map((entry) => <TableRow key={entry.attendanceEntryId}><TableCell className="font-medium">{statusLabel(entry.entryType)}</TableCell><TableCell>{formatDateTime(entry.entryTime)}</TableCell><TableCell><Badge variant="outline">{statusLabel(entry.source)}</Badge></TableCell>{canWrite && <TableCell><div className="flex justify-end gap-1"><AttendanceEntryDialog record={record} entry={entry} /><DeleteAttendanceEntry record={record} entry={entry} /></div></TableCell>}</TableRow>) : <TableRow><TableCell colSpan={canWrite ? 4 : 3} className="py-10 text-center text-muted-foreground">No punches were recorded for this day.</TableCell></TableRow>}</TableBody></Table></div>{record.notes && <p className="mt-4 text-sm text-muted-foreground"><strong className="text-foreground">Notes:</strong> {record.notes}</p>}</CardContent></Card></div>;
}
