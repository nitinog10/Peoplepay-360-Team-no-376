"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { FormBanner } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, attendanceKeys, type MarkAbsencesResult } from "@/lib/api";
import { todayDateOnly } from "@/lib/format";

export function MarkAbsencesDialog() {
  const queryClient = useQueryClient(); const [open, setOpen] = useState(false); const [date, setDate] = useState(todayDateOnly()); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const [result, setResult] = useState<MarkAbsencesResult | null>(null);
  async function run() { setPending(true); setError(null); try { const next = await api.attendance.markAbsences(date); setResult(next); await queryClient.invalidateQueries({ queryKey: attendanceKeys.all }); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Day close could not be completed."); } finally { setPending(false); } }
  const created = result ? result.created.ABSENT + result.created.ON_LEAVE + result.created.WEEK_OFF : 0;
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); if (!next) setResult(null); }}><DialogTrigger asChild><Button type="button" variant="outline">Mark absences</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Mark absences</DialogTitle><DialogDescription>Close the selected day for active employees without an attendance record. Re-running is safe and reports skipped rows.</DialogDescription></DialogHeader><FormBanner message={error} /><div className="flex flex-col gap-1.5"><Label htmlFor="absence-date">Date</Label><Input id="absence-date" type="date" max={todayDateOnly()} value={date} onChange={(event) => { setDate(event.target.value); setResult(null); }} /></div>{result && <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm"><p className="col-span-2 font-medium">Created {created} records</p><p>Absent: {result.created.ABSENT}</p><p>On leave: {result.created.ON_LEAVE}</p><p>Week off: {result.created.WEEK_OFF}</p><p>Existing: {result.skipped.hasRecord}</p><p>No schedule: {result.skipped.noSchedule}</p></div>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button><Button type="button" disabled={pending || !date} onClick={() => void run()}>{pending && <LoaderCircleIcon className="animate-spin" />} Run day close</Button></DialogFooter></DialogContent></Dialog>;
}
