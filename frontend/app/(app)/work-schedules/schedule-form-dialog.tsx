"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, workScheduleKeys, type WorkSchedule, type WorkScheduleBody } from "@/lib/api";

const DAYS = [
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"],
] as const;

const schema = z.object({
  scheduleName: z.string().trim().min(1, "Schedule name is required").max(100),
  daysOfWeek: z.array(z.number()).min(1, "Select at least one working day"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24h)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24h)"),
  description: z.string().trim().max(5000),
});

type Values = z.infer<typeof schema>;

function defaults(schedule?: WorkSchedule): Values {
  return {
    scheduleName: schedule?.scheduleName ?? "",
    daysOfWeek: schedule?.daysOfWeek ?? [1, 2, 3, 4, 5],
    startTime: schedule?.startTime ?? "09:00",
    endTime: schedule?.endTime ?? "17:00",
    description: schedule?.description ?? "",
  };
}

function asBody(values: Values): WorkScheduleBody {
  return {
    scheduleName: values.scheduleName.trim(),
    daysOfWeek: [...values.daysOfWeek].sort((a, b) => a - b),
    startTime: values.startTime,
    endTime: values.endTime,
    description: values.description.trim() || null,
  };
}

function minutes(value: string): number {
  const [hours, mins] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(mins) ? hours * 60 + mins : 0;
}

export function ScheduleFormDialog({ schedule, trigger }: { schedule?: WorkSchedule; trigger: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useApiForm<Values, WorkSchedule>({
    schema,
    defaultValues: defaults(schedule),
    fields: ["scheduleName", "daysOfWeek", "startTime", "endTime", "description"],
    submit: (values) => schedule
      ? api.workSchedules.update(schedule.scheduleId, asBody(values))
      : api.workSchedules.create(asBody(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(workScheduleKeys.detail(saved.scheduleId), saved);
      void queryClient.invalidateQueries({ queryKey: workScheduleKeys.all });
      setOpen(false);
      toast.success(`Saved — ${saved.weeklyHours} weekly hours`);
    },
  });
  const { register } = form.form;
  const selected = form.form.watch("daysOfWeek");
  const start = form.form.watch("startTime");
  const end = form.form.watch("endTime");
  const weeklyHours = Math.max(0, (minutes(end) - minutes(start)) / 60) * selected.length;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(schedule)); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{schedule ? `Edit ${schedule.scheduleName}` : "New working schedule"}</DialogTitle>
          <DialogDescription>Weekly hours are previewed here and always recalculated by the API.</DialogDescription>
        </DialogHeader>
        <Form api={form}>
          <Field name="scheduleName" label="Schedule name" required>{(control) => <Input {...control} {...register("scheduleName")} />}</Field>
          <Field name="daysOfWeek" label="Working days" required>
            {(control) => (
              <div {...control} className="flex flex-wrap gap-3 rounded-lg border p-3">
                {DAYS.map(([value, label]) => (
                  <Label key={value} className="flex items-center gap-2 font-normal">
                    <Checkbox
                      checked={selected.includes(value)}
                      onCheckedChange={(checked) => form.form.setValue("daysOfWeek", checked ? [...selected, value] : selected.filter((day) => day !== value), { shouldDirty: true, shouldValidate: true })}
                    />
                    {label}
                  </Label>
                ))}
              </div>
            )}
          </Field>
          <FormGrid>
            <Field name="startTime" label="Start time" required>{(control) => <Input {...control} type="time" {...register("startTime")} />}</Field>
            <Field name="endTime" label="End time" required>{(control) => <Input {...control} type="time" {...register("endTime")} />}</Field>
          </FormGrid>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="text-muted-foreground">Weekly hours preview:</span> <output className="font-medium">{weeklyHours}</output></div>
          <Field name="description" label="Description">{(control) => <Textarea {...control} {...register("description")} />}</Field>
          <FormActions><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton pending={form.isSubmitting}>{schedule ? "Save changes" : "Create schedule"}</SubmitButton></FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
