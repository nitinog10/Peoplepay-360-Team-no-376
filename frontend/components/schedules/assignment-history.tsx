"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormBanner, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ApiError,
  api,
  employeeKeys,
  workScheduleKeys,
  type CreateScheduleAssignmentBody,
  type ScheduleAssignment,
  type UpdateScheduleAssignmentBody,
} from "@/lib/api";
import { formatDate, todayDateOnly, toDateOnly } from "@/lib/format";

const schema = z.object({
  scheduleId: z.string().min(1, "Select a schedule"),
  effectiveFrom: z.string().min(1, "Effective from is required"),
  effectiveTo: z.string(),
  closePrevious: z.boolean(),
}).refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
  path: ["effectiveTo"], message: "Effective to must be on or after effective from",
});

type Values = z.infer<typeof schema>;

function defaults(assignment?: ScheduleAssignment): Values {
  return {
    scheduleId: assignment ? String(assignment.scheduleId) : "",
    effectiveFrom: assignment ? toDateOnly(assignment.effectiveFrom) : todayDateOnly(),
    effectiveTo: assignment?.effectiveTo ? toDateOnly(assignment.effectiveTo) : "",
    closePrevious: true,
  };
}

function AssignmentDialog({ employeeId, assignment, disabled = false }: { employeeId: number; assignment?: ScheduleAssignment; disabled?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const schedules = useQuery({ ...api.workSchedules.list({ pageSize: 100, sort: "scheduleName", order: "asc" }), enabled: open });
  const form = useApiForm<Values, ScheduleAssignment>({
    schema,
    defaultValues: defaults(assignment),
    fields: ["scheduleId", "effectiveFrom", "effectiveTo", "closePrevious"],
    submit: (values) => {
      const common = {
        scheduleId: Number(values.scheduleId),
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo || null,
      };
      return assignment
        ? api.employees.updateAssignment(assignment.assignmentId, common as UpdateScheduleAssignmentBody)
        : api.employees.createAssignment(employeeId, { ...common, closePrevious: values.closePrevious } as CreateScheduleAssignmentBody);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: employeeKeys.assignments(employeeId) });
      void queryClient.invalidateQueries({ queryKey: employeeKeys.summary(employeeId) });
      void queryClient.invalidateQueries({ queryKey: employeeKeys.mySchedule });
      void queryClient.invalidateQueries({ queryKey: workScheduleKeys.all });
      setOpen(false);
      toast.success(assignment ? "Schedule assignment updated" : "Schedule assigned");
    },
  });
  const { register } = form.form;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(assignment)); }}>
      <DialogTrigger asChild>
        {assignment
          ? <Button type="button" variant="ghost" size="icon-sm"><PencilIcon /><span className="sr-only">Edit assignment</span></Button>
          : <Button type="button" disabled={disabled}><PlusIcon /> Assign schedule</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{assignment ? "Edit schedule assignment" : "Assign working schedule"}</DialogTitle><DialogDescription>Date ranges are inclusive. New assignments can automatically close an older open assignment.</DialogDescription></DialogHeader>
        <Form api={form}>
          <Field name="scheduleId" label="Schedule" required>{(control) => (
            <Select value={form.form.watch("scheduleId") || undefined} onValueChange={(value) => form.form.setValue("scheduleId", value, { shouldValidate: true })}>
              <SelectTrigger {...control} className="w-full"><SelectValue placeholder="Select schedule" /></SelectTrigger>
              <SelectContent>{(schedules.data?.data ?? []).map((schedule) => <SelectItem key={schedule.scheduleId} value={String(schedule.scheduleId)}>{schedule.scheduleName} · {schedule.weeklyHours}h</SelectItem>)}</SelectContent>
            </Select>
          )}</Field>
          <FormGrid>
            <Field name="effectiveFrom" label="Effective from" required>{(control) => <Input {...control} type="date" {...register("effectiveFrom")} />}</Field>
            <Field name="effectiveTo" label="Effective to">{(control) => <Input {...control} type="date" {...register("effectiveTo")} />}</Field>
          </FormGrid>
          {!assignment && <Field name="closePrevious">{() => <Label className="flex items-start gap-2 font-normal"><Checkbox checked={form.form.watch("closePrevious")} onCheckedChange={(checked) => form.form.setValue("closePrevious", checked === true, { shouldDirty: true })} /><span>End the current open assignment the day before this one starts.</span></Label>}</Field>}
          <FormActions><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton pending={form.isSubmitting} disabled={schedules.isPending}>{assignment ? "Save assignment" : "Assign schedule"}</SubmitButton></FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAssignment({ employeeId, assignment }: { employeeId: number; assignment: ScheduleAssignment }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true); setError(null);
    try {
      await api.employees.removeAssignment(assignment.assignmentId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employeeKeys.assignments(employeeId) }),
        queryClient.invalidateQueries({ queryKey: employeeKeys.summary(employeeId) }),
        queryClient.invalidateQueries({ queryKey: employeeKeys.mySchedule }),
        queryClient.invalidateQueries({ queryKey: workScheduleKeys.all }),
      ]);
      setOpen(false); toast.success("Schedule assignment deleted");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Assignment could not be deleted.");
    } finally { setPending(false); }
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}><DialogTrigger asChild><Button type="button" variant="ghost" size="icon-sm"><Trash2Icon /><span className="sr-only">Delete assignment</span></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Delete this assignment?</DialogTitle><DialogDescription>This removes the schedule history row and may change the employee’s current schedule.</DialogDescription></DialogHeader><FormBanner message={error} /><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>{pending && <LoaderCircleIcon className="animate-spin" />} Delete assignment</Button></DialogFooter></DialogContent></Dialog>;
}

export function AssignmentHistory({ employeeId, terminated }: { employeeId: number; terminated: boolean }) {
  const query = useQuery(api.employees.assignments(employeeId));

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle>Schedule assignment history</CardTitle>{terminated && <p className="mt-1 text-sm text-muted-foreground">Terminated employees cannot receive new assignments.</p>}</div><AssignmentDialog employeeId={employeeId} disabled={terminated} /></CardHeader>
      <CardContent>
        {query.isPending ? <Skeleton className="h-32" /> : query.error ? <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6"><p className="text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Assignment history could not be loaded."}</p><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></div> : (query.data?.data ?? []).length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No schedule assignments yet.</p> : (
          <Table><TableHeader><TableRow><TableHead>Schedule</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Weekly</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{(query.data?.data ?? []).map((assignment) => <TableRow key={assignment.assignmentId}><TableCell className="font-medium">{assignment.schedule.scheduleName}</TableCell><TableCell>{formatDate(assignment.effectiveFrom)}</TableCell><TableCell>{assignment.effectiveTo ? formatDate(assignment.effectiveTo) : "Ongoing"}</TableCell><TableCell>{assignment.schedule.weeklyHours}h</TableCell><TableCell><div className="flex justify-end gap-1"><AssignmentDialog employeeId={employeeId} assignment={assignment} /><DeleteAssignment employeeId={employeeId} assignment={assignment} /></div></TableCell></TableRow>)}</TableBody></Table>
        )}
      </CardContent>
    </Card>
  );
}
