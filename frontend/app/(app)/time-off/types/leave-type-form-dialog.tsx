"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, leaveBalanceKeys, leaveTypeKeys, timeOffKeys, type LeaveType, type LeaveTypeBody } from "@/lib/api";

const schema = z.object({
  typeName: z.string().trim().min(1, "Type name is required").max(50),
  defaultAnnualDays: z.number().min(0).max(999.99).multipleOf(0.01, "Use no more than two decimal places"),
  description: z.string().trim().max(5000),
});

type Values = z.infer<typeof schema>;

function defaults(leaveType?: LeaveType): Values {
  return {
    typeName: leaveType?.typeName ?? "",
    defaultAnnualDays: leaveType?.defaultAnnualDays ?? 0,
    description: leaveType?.description ?? "",
  };
}

function asBody(values: Values): LeaveTypeBody {
  return {
    typeName: values.typeName.trim(),
    defaultAnnualDays: values.defaultAnnualDays,
    description: values.description.trim() || null,
  };
}

export function LeaveTypeFormDialog({ leaveType, trigger }: { leaveType?: LeaveType; trigger: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useApiForm<Values, LeaveType>({
    schema,
    defaultValues: defaults(leaveType),
    fields: ["typeName", "defaultAnnualDays", "description"],
    submit: (values) => leaveType
      ? api.leaveTypes.update(leaveType.leaveTypeId, asBody(values))
      : api.leaveTypes.create(asBody(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(leaveTypeKeys.detail(saved.leaveTypeId), saved);
      void queryClient.invalidateQueries({ queryKey: leaveTypeKeys.all });
      if (leaveType) {
        void queryClient.invalidateQueries({ queryKey: leaveBalanceKeys.all });
        void queryClient.invalidateQueries({ queryKey: timeOffKeys.all });
      }
      setOpen(false);
      toast.success(leaveType ? "Time off type updated" : "Time off type created");
    },
  });
  const { register } = form.form;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(leaveType)); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{leaveType ? `Edit ${leaveType.typeName}` : "New time off type"}</DialogTitle>
          <DialogDescription>Set the default annual allowance used when leave balances are initialized.</DialogDescription>
        </DialogHeader>
        <Form api={form}>
          <FormGrid>
            <Field name="typeName" label="Type name" required>
              {(control) => <Input {...control} {...register("typeName")} />}
            </Field>
            <Field
              name="defaultAnnualDays"
              label="Default annual days"
              required
              description="0 means this type is not balance-tracked (for example, Unpaid)."
            >
              {(control) => <Input {...control} type="number" min={0} max={999.99} step="0.01" {...register("defaultAnnualDays", { valueAsNumber: true })} />}
            </Field>
          </FormGrid>
          <Field name="description" label="Description">
            {(control) => <Textarea {...control} rows={4} {...register("description")} />}
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={form.isSubmitting}>{leaveType ? "Save changes" : "Create type"}</SubmitButton>
          </FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
