"use client";

import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormBanner, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, api, attendanceKeys, type AttendanceEntry, type AttendanceEntryType, type AttendanceRecord } from "@/lib/api";

const TYPES: readonly AttendanceEntryType[] = ["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"];
const schema = z.object({ entryType: z.enum(["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"]), entryTime: z.string().min(1, "Time is required") });
type Values = z.infer<typeof schema>;

function localValue(value: string): string { return format(parseISO(value), "yyyy-MM-dd'T'HH:mm"); }
function defaults(record: AttendanceRecord, entry?: AttendanceEntry): Values { return { entryType: entry?.entryType ?? "CLOCK_IN", entryTime: entry ? localValue(entry.entryTime) : `${record.attendanceDate.slice(0, 10)}T09:00` }; }

export function AttendanceEntryDialog({ record, entry }: { record: AttendanceRecord; entry?: AttendanceEntry }) {
  const queryClient = useQueryClient(); const [open, setOpen] = useState(false);
  const form = useApiForm<Values, AttendanceRecord>({ schema, defaultValues: defaults(record, entry), fields: ["entryType", "entryTime"], submit: (values) => { const body = { entryType: values.entryType, entryTime: new Date(values.entryTime).toISOString(), source: "MANUAL" as const }; return entry ? api.attendance.updateEntry(entry.attendanceEntryId, body) : api.attendance.addEntry(record.attendanceRecordId, body); }, onSuccess: (saved) => { queryClient.setQueryData(attendanceKeys.detail(record.attendanceRecordId), saved); void queryClient.invalidateQueries({ queryKey: attendanceKeys.all }); setOpen(false); toast.success(entry ? "Punch corrected" : "Punch added"); } });
  const { register } = form.form;
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(record, entry)); }}><DialogTrigger asChild>{entry ? <Button type="button" variant="ghost" size="icon-sm"><PencilIcon /><span className="sr-only">Edit punch</span></Button> : <Button type="button" variant="outline"><PlusIcon /> Add punch</Button>}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{entry ? "Correct punch" : "Add manual punch"}</DialogTitle><DialogDescription>The API validates the complete chronological punch sequence and recalculates all day totals.</DialogDescription></DialogHeader><Form api={form}><Field name="entryType" label="Punch type" required>{(control) => <Select value={form.form.watch("entryType")} onValueChange={(value) => form.form.setValue("entryType", value as AttendanceEntryType, { shouldValidate: true })}><SelectTrigger {...control} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>}</Field><Field name="entryTime" label="Punch time" required>{(control) => <Input {...control} type="datetime-local" {...register("entryTime")} />}</Field><FormActions><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton pending={form.isSubmitting}>{entry ? "Save correction" : "Add punch"}</SubmitButton></FormActions></Form></DialogContent></Dialog>;
}

export function DeleteAttendanceEntry({ record, entry }: { record: AttendanceRecord; entry: AttendanceEntry }) {
  const queryClient = useQueryClient(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function remove() { setPending(true); setError(null); try { const saved = await api.attendance.removeEntry(entry.attendanceEntryId); queryClient.setQueryData(attendanceKeys.detail(record.attendanceRecordId), saved); await queryClient.invalidateQueries({ queryKey: attendanceKeys.all }); setOpen(false); toast.success("Punch deleted"); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Punch could not be deleted."); } finally { setPending(false); } }
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}><DialogTrigger asChild><Button type="button" variant="ghost" size="icon-sm"><Trash2Icon /><span className="sr-only">Delete punch</span></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Delete this punch?</DialogTitle><DialogDescription>The API will reject deletion if the remaining punch sequence would be invalid.</DialogDescription></DialogHeader><FormBanner message={error} /><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>{pending && <LoaderCircleIcon className="animate-spin" />} Delete punch</Button></DialogFooter></DialogContent></Dialog>;
}
