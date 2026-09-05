"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlusIcon, CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { z } from "zod";

import { Field, Form, FormActions, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  employeeKeys,
  leaveBalanceKeys,
  timeOffKeys,
  type TimeOffRequest,
} from "@/lib/api";
import { formatDays, toDateOnly } from "@/lib/format";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const requestSchema = z
  .object({
    leaveTypeId: z.number().int().positive("Choose a leave type."),
    startDate: z.string().regex(dateOnly, "Choose a start date."),
    endDate: z.string().regex(dateOnly, "Choose an end date."),
    reason: z.string().trim().max(5000, "Reason must be 5,000 characters or fewer."),
  })
  .refine((values) => values.endDate >= values.startDate, {
    path: ["endDate"],
    message: "End date must be on or after start date.",
  });

type RequestValues = z.infer<typeof requestSchema>;

function defaults(request?: TimeOffRequest): RequestValues {
  return {
    leaveTypeId: request?.leaveTypeId ?? 0,
    startDate: request ? toDateOnly(request.startDate) : "",
    endDate: request ? toDateOnly(request.endDate) : "",
    reason: request?.reason ?? "",
  };
}

/** Create or edit an employee-owned request. The API remains the source of total days. */
export function RequestTimeOffDialog({
  request,
  trigger,
}: {
  request?: TimeOffRequest;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TimeOffRequest | null>(null);
  const queryClient = useQueryClient();
  const leaveTypes = useQuery(api.leaveTypes.list({ pageSize: 100, sort: "typeName", order: "asc" }));
  const initial = defaults(request);

  const formApi = useApiForm<RequestValues, TimeOffRequest>({
    schema: requestSchema,
    defaultValues: initial,
    fields: ["leaveTypeId", "startDate", "endDate", "reason"],
    submit: (values) => {
      const body = { ...values, reason: values.reason || null };
      return request
        ? api.timeOff.update(request.timeOffRequestId, body)
        : api.timeOff.create(body);
    },
    onSuccess: (created) => {
      setResult(created);
      void queryClient.invalidateQueries({ queryKey: timeOffKeys.all });
      void queryClient.invalidateQueries({ queryKey: leaveBalanceKeys.all });
      void queryClient.invalidateQueries({ queryKey: employeeKeys.summary("me") });
    },
  });

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) setResult(null);
    if (!next) formApi.form.reset(initial);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <CalendarPlusIcon /> Request time off
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{request ? "Edit time-off request" : "Request time off"}</DialogTitle>
          <DialogDescription>
            Working days and balance availability are computed by the service when you submit.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-success/10 text-success">
              <CheckCircle2Icon className="size-6" />
            </span>
            <div>
              <p className="font-medium">{request ? "Request updated" : "Request submitted"}</p>
              <p className="text-sm text-muted-foreground">
                The service calculated {formatDays(result.totalDays)}. Status: {result.status.toLowerCase()}.
              </p>
            </div>
          </div>
        ) : (
          <Form api={formApi}>
            <Controller
              control={formApi.form.control}
              name="leaveTypeId"
              render={({ field }) => (
                <Field name="leaveTypeId" label="Leave type" required>
                  {(control) => (
                    <Select
                      value={field.value > 0 ? String(field.value) : undefined}
                      onValueChange={(value) => field.onChange(Number(value))}
                      disabled={leaveTypes.isPending || leaveTypes.isError}
                    >
                      <SelectTrigger {...control} className="w-full">
                        <SelectValue
                          placeholder={
                            leaveTypes.isPending
                              ? "Loading leave types…"
                              : leaveTypes.isError
                                ? "Could not load leave types"
                                : "Choose a leave type"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.data?.data.map((type) => (
                          <SelectItem key={type.leaveTypeId} value={String(type.leaveTypeId)}>
                            {type.typeName}
                            {!type.requiresBalance ? " · untracked" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              )}
            />

            <FormGrid>
              <Field name="startDate" label="Start date" required>
                {(control) => (
                  <Input type="date" {...control} {...formApi.form.register("startDate")} />
                )}
              </Field>
              <Field name="endDate" label="End date" required>
                {(control) => (
                  <Input type="date" {...control} {...formApi.form.register("endDate")} />
                )}
              </Field>
            </FormGrid>

            <Field name="reason" label="Reason" description="Optional · up to 5,000 characters">
              {(control) => (
                <Textarea rows={4} {...control} {...formApi.form.register("reason")} />
              )}
            </Field>

            <FormActions>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <SubmitButton pending={formApi.isSubmitting} disabled={leaveTypes.isError}>
                {formApi.isSubmitting && <LoaderCircleIcon className="animate-spin" />}
                {request ? "Save changes" : "Submit request"}
              </SubmitButton>
            </FormActions>
          </Form>
        )}

        {result && (
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
