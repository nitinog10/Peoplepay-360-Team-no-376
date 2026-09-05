"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormBanner, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, attendanceKeys, type AttendanceRecord, type AttendanceStatus } from "@/lib/api";
import { todayDateOnly, toDateOnly } from "@/lib/format";

const STATUSES: readonly AttendanceStatus[] = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEK_OFF"];
const schema = z.object({ employeeId: z.string(), attendanceDate: z.string().min(1, "Date is required"), status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEK_OFF"]), notes: z.string().trim().max(5000) });
type Values = z.infer<typeof schema>;

function defaults(record?: AttendanceRecord, employeeId?: number): Values {
  return { employeeId: record ? String(record.employeeId) : employeeId ? String(employeeId) : "", attendanceDate: record ? toDateOnly(record.attendanceDate) : todayDateOnly(), status: record?.status ?? "PRESENT", notes: record?.notes ?? "" };
}

export function AttendanceRecordDialog({ record, defaultEmployeeId, trigger }: { record?: AttendanceRecord; defaultEmployeeId?: number; trigger: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const employees = useQuery({ ...api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }), enabled: open && !record });
  const form = useApiForm<Values, AttendanceRecord>({
    schema,
    defaultValues: defaults(record, defaultEmployeeId),
    fields: ["employeeId", "attendanceDate", "status", "notes"],
    submit: (values) => record
      ? api.attendance.updateRecord(record.attendanceRecordId, { attendanceDate: values.attendanceDate, status: values.status, notes: values.notes.trim() || null })
      : api.attendance.createRecord({ employeeId: Number(values.employeeId), attendanceDate: values.attendanceDate, status: values.status, notes: values.notes.trim() || null }),
    onSuccess: (saved) => {
      queryClient.setQueryData(attendanceKeys.detail(saved.attendanceRecordId), saved);
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      setOpen(false); toast.success(record ? "Attendance record updated" : "Attendance record created");
      if (!record) router.push(`/attendance/${saved.attendanceRecordId}`);
    },
  });
  const { register } = form.form;
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(record, defaultEmployeeId)); }}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{record ? "Edit attendance record" : "New attendance record"}</DialogTitle><DialogDescription>Create or correct the day record; punches are maintained on its detail screen.</DialogDescription></DialogHeader><Form api={form}><FormGrid>{!record && <Field name="employeeId" label="Employee" required>{(control) => <Select value={form.form.watch("employeeId") || undefined} onValueChange={(value) => form.form.setValue("employeeId", value, { shouldValidate: true })}><SelectTrigger {...control} className="w-full"><SelectValue placeholder="Select employee" /></SelectTrigger><SelectContent>{(employees.data?.data ?? []).map((employee) => <SelectItem key={employee.employeeId} value={String(employee.employeeId)}>{employee.fullName}</SelectItem>)}</SelectContent></Select>}</Field>}<Field name="attendanceDate" label="Attendance date" required>{(control) => <Input {...control} type="date" {...register("attendanceDate")} />}</Field><Field name="status" label="Status" required>{(control) => <Select value={form.form.watch("status")} onValueChange={(value) => form.form.setValue("status", value as AttendanceStatus, { shouldValidate: true })}><SelectTrigger {...control} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>}</Field><Field name="notes" label="Notes" className="sm:col-span-2">{(control) => <Textarea {...control} {...register("notes")} />}</Field></FormGrid><FormActions><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton pending={form.isSubmitting} disabled={!record && (employees.isPending || !form.form.watch("employeeId"))}>{record ? "Save changes" : "Create record"}</SubmitButton></FormActions></Form></DialogContent></Dialog>;
}

export function DeleteAttendanceRecord({ record }: { record: AttendanceRecord }) {
  const router = useRouter(); const queryClient = useQueryClient(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function remove() { setPending(true); setError(null); try { await api.attendance.removeRecord(record.attendanceRecordId); await queryClient.invalidateQueries({ queryKey: attendanceKeys.all }); setOpen(false); toast.success("Attendance record deleted"); router.replace("/attendance"); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Attendance record could not be deleted."); } finally { setPending(false); } }
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}><DialogTrigger asChild><Button type="button" variant="destructive"><Trash2Icon /> Delete record</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Delete this attendance record?</DialogTitle><DialogDescription>This permanently removes the day and all of its punches.</DialogDescription></DialogHeader><FormBanner message={error} /><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>{pending && <LoaderCircleIcon className="animate-spin" />} Delete record</Button></DialogFooter></DialogContent></Dialog>;
}
