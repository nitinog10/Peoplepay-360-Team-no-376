"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  salaryRuleKeys,
  salaryStructureKeys,
  type SalaryRule,
  type SalaryRuleBase,
  type SalaryRuleBody,
  type SalaryRuleCategory,
  type SalaryRuleListItem,
  type SalaryRuleMethod,
} from "@/lib/api";

const CATEGORIES: SalaryRuleCategory[] = ["BASIC", "ALLOWANCE", "GROSS", "DEDUCTION", "NET"];
const METHODS: SalaryRuleMethod[] = ["FIXED", "PERCENTAGE", "FORMULA"];
const BASES: SalaryRuleBase[] = ["CONTRACT_WAGE", "BASIC", "GROSS"];

const schema = z.object({
  salaryStructureId: z.number().int().positive("Select a structure"),
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z.string().trim().min(1, "Code is required").max(50).transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z][A-Z0-9_]*$/, "Use uppercase letters, numbers and underscores")),
  category: z.enum(CATEGORIES),
  sequence: z.number().int().positive("Use a positive sequence"),
  method: z.enum(METHODS),
  fixedAmount: z.number().min(0).nullable(),
  percentage: z.number().min(0).max(10000).nullable(),
  percentageBase: z.enum(BASES).nullable(),
  formula: z.string().trim().max(2000),
  isActive: z.boolean(),
}).superRefine((values, ctx) => {
  if (values.method === "FIXED" && values.fixedAmount === null) ctx.addIssue({ code: "custom", path: ["fixedAmount"], message: "Fixed amount is required" });
  if (values.method === "PERCENTAGE" && values.percentage === null) ctx.addIssue({ code: "custom", path: ["percentage"], message: "Percentage is required" });
  if (values.method === "PERCENTAGE" && !values.percentageBase) ctx.addIssue({ code: "custom", path: ["percentageBase"], message: "Percentage base is required" });
  if (values.method === "FORMULA" && !values.formula) ctx.addIssue({ code: "custom", path: ["formula"], message: "Formula is required" });
});
type Values = z.infer<typeof schema>;

function defaults(rule?: SalaryRule, structureId?: number, sequence?: number): Values {
  return {
    salaryStructureId: rule?.salaryStructureId ?? structureId ?? 0,
    name: rule?.name ?? "",
    code: rule?.code ?? "",
    category: rule?.category ?? "ALLOWANCE",
    sequence: rule?.sequence ?? sequence ?? 10,
    method: rule?.method ?? "FIXED",
    fixedAmount: rule?.fixedAmount ?? 0,
    percentage: rule?.percentage ?? null,
    percentageBase: rule?.percentageBase ?? null,
    formula: rule?.formula ?? "",
    isActive: rule?.isActive ?? true,
  };
}

function asBody(values: Values): SalaryRuleBody {
  return {
    salaryStructureId: values.salaryStructureId,
    name: values.name.trim(),
    code: values.code.toUpperCase(),
    category: values.category,
    sequence: values.sequence,
    method: values.method,
    fixedAmount: values.method === "FIXED" ? values.fixedAmount : null,
    percentage: values.method === "PERCENTAGE" ? values.percentage : null,
    percentageBase: values.method === "PERCENTAGE" ? values.percentageBase : null,
    formula: values.method === "FORMULA" ? values.formula.trim() : null,
    isActive: values.isActive,
  };
}

export function SalaryRuleFormDialog({ rule, structureId, nextSequence, trigger }: { rule?: SalaryRule; structureId?: number; nextSequence?: number; trigger: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const structures = useQuery({ ...api.salaryStructures.list({ pageSize: 100 }), enabled: open });
  const form = useApiForm<Values, SalaryRuleListItem>({
    schema,
    defaultValues: defaults(rule, structureId, nextSequence),
    fields: ["salaryStructureId", "name", "code", "category", "sequence", "method", "fixedAmount", "percentage", "percentageBase", "formula", "isActive"],
    submit: (values) => rule ? api.salaryRules.update(rule.salaryRuleId, asBody(values)) : api.salaryRules.create(asBody(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(salaryRuleKeys.detail(saved.salaryRuleId), saved);
      void queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all });
      void queryClient.invalidateQueries({ queryKey: salaryStructureKeys.all });
      setOpen(false);
      toast.success(rule ? "Salary rule updated." : "Salary rule created.");
    },
  });
  const method = form.form.watch("method");
  const { register } = form.form;
  const reset = () => form.form.reset(defaults(rule, structureId, nextSequence));

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{rule ? `Edit ${rule.name}` : "New salary rule"}</DialogTitle><DialogDescription>Rules execute in sequence. Formula references may only use values calculated earlier.</DialogDescription></DialogHeader>
        <Form api={form}>
          <Controller control={form.form.control} name="salaryStructureId" render={({ field }) => <Field name="salaryStructureId" label="Salary structure" required>{(control) => <Select value={field.value > 0 ? String(field.value) : undefined} onValueChange={(value) => field.onChange(Number(value))} disabled={structureId !== undefined}><SelectTrigger {...control} className="w-full"><SelectValue placeholder="Select a structure" /></SelectTrigger><SelectContent>{structures.data?.data.map((structure) => <SelectItem key={structure.salaryStructureId} value={String(structure.salaryStructureId)}>{structure.name}</SelectItem>)}</SelectContent></Select>}</Field>} />
          <FormGrid>
            <Field name="name" label="Rule name" required>{(control) => <Input {...control} {...register("name")} />}</Field>
            <Field name="code" label="Code" required>{(control) => <Input {...control} className="font-mono uppercase" {...register("code")} />}</Field>
            <Controller control={form.form.control} name="category" render={({ field }) => <Field name="category" label="Category" required>{(control) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger {...control} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}</Field>} />
            <Field name="sequence" label="Sequence" required description="Unique within this structure.">{(control) => <Input {...control} type="number" min={1} step={1} {...register("sequence", { valueAsNumber: true })} />}</Field>
            <Controller control={form.form.control} name="method" render={({ field }) => <Field name="method" label="Computation" required>{(control) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger {...control} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{METHODS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>}</Field>} />
            <Field name="isActive" label="Availability">{(control) => <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm"><input {...control} type="checkbox" {...register("isActive")} /> Active</label>}</Field>
          </FormGrid>
          {method === "FIXED" && <Field name="fixedAmount" label="Fixed amount" required>{(control) => <Input {...control} type="number" min={0} step="0.01" {...register("fixedAmount", { setValueAs: (value) => value === "" ? null : Number(value) })} />}</Field>}
          {method === "PERCENTAGE" && <FormGrid><Field name="percentage" label="Percentage" required>{(control) => <Input {...control} type="number" min={0} step="0.0001" {...register("percentage", { setValueAs: (value) => value === "" ? null : Number(value) })} />}</Field><Controller control={form.form.control} name="percentageBase" render={({ field }) => <Field name="percentageBase" label="Base" required>{(control) => <Select value={field.value ?? undefined} onValueChange={field.onChange}><SelectTrigger {...control} className="w-full"><SelectValue placeholder="Select a base" /></SelectTrigger><SelectContent>{BASES.map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>}</Field>} /></FormGrid>}
          {method === "FORMULA" && <Field name="formula" label="Formula" required description="Allowed: numbers, + − × ÷, parentheses, min/max/round, contractWage, workedDays, workedHours, expectedDays, expectedHours, unpaidDays, categories['BASIC'], and rules['CODE'] from earlier sequences.">{(control) => <Textarea {...control} rows={4} className="font-mono text-xs" {...register("formula")} />}</Field>}
          <FormActions><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton pending={form.isSubmitting}>{rule ? "Save changes" : "Create rule"}</SubmitButton></FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
