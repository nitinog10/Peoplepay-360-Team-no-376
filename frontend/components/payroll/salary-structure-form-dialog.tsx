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
import { api, salaryRuleKeys, salaryStructureKeys, type SalaryStructureBody, type SalaryStructureDetail, type SalaryStructureFields } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(5000),
  currency: z.string().trim().length(3, "Use a three-letter currency code").transform((value) => value.toUpperCase()),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

function defaults(structure?: SalaryStructureFields): Values {
  return {
    name: structure?.name ?? "",
    description: structure?.description ?? "",
    currency: structure?.currency ?? "INR",
    isActive: structure?.isActive ?? true,
  };
}

function body(values: Values): SalaryStructureBody {
  return { ...values, name: values.name.trim(), description: values.description.trim() || null, currency: values.currency.toUpperCase() };
}

export function SalaryStructureFormDialog({ structure, trigger }: { structure?: SalaryStructureFields; trigger: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useApiForm<Values, SalaryStructureDetail>({
    schema,
    defaultValues: defaults(structure),
    fields: ["name", "description", "currency", "isActive"],
    submit: (values) => structure ? api.salaryStructures.update(structure.salaryStructureId, body(values)) : api.salaryStructures.create(body(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(salaryStructureKeys.detail(saved.salaryStructureId), saved);
      void queryClient.invalidateQueries({ queryKey: salaryStructureKeys.all });
      void queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all });
      setOpen(false);
      toast.success(structure ? "Salary structure updated." : "Salary structure created.");
    },
  });
  const { register } = form.form;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(structure)); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{structure ? `Edit ${structure.name}` : "New salary structure"}</DialogTitle><DialogDescription>Structures group ordered rules and define the payroll currency.</DialogDescription></DialogHeader>
        <Form api={form}>
          <Field name="name" label="Name" required>{(control) => <Input {...control} {...register("name")} />}</Field>
          <FormGrid>
            <Field name="currency" label="Currency" required description="ISO 4217 code, for example INR or USD.">{(control) => <Input {...control} maxLength={3} className="uppercase" {...register("currency")} />}</Field>
            <Field name="isActive" label="Availability" description="Inactive structures cannot be selected for new payruns.">{(control) => <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm"><input {...control} type="checkbox" {...register("isActive")} /> Active</label>}</Field>
          </FormGrid>
          <Field name="description" label="Description">{(control) => <Textarea {...control} rows={4} {...register("description")} />}</Field>
          <FormActions><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton pending={form.isSubmitting}>{structure ? "Save changes" : "Create structure"}</SubmitButton></FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
