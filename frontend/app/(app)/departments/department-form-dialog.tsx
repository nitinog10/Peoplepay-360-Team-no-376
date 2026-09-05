"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sessionKey } from "@/lib/auth/session";
import { api, attendanceKeys, departmentKeys, employeeKeys, timeOffKeys, type Department, type DepartmentBody, type SessionUser } from "@/lib/api";
import { DEPARTMENT_FIELDS } from "@/lib/api/departments";

const schema = z.object({
  departmentName: z.string().trim().min(1, "Department name is required").max(100),
  description: z.string().trim().max(5000),
});

type Values = z.infer<typeof schema>;

function defaults(department?: Department): Values {
  return {
    departmentName: department?.departmentName ?? "",
    description: department?.description ?? "",
  };
}

function asBody(values: Values): DepartmentBody {
  return {
    departmentName: values.departmentName.trim(),
    description: values.description.trim() || null,
  };
}

export function DepartmentFormDialog({ department, trigger }: { department?: Department; trigger: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useApiForm<Values, Department>({
    schema,
    defaultValues: defaults(department),
    fields: DEPARTMENT_FIELDS,
    submit: (values) => department
      ? api.departments.update(department.departmentId, asBody(values))
      : api.departments.create(asBody(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(departmentKeys.detail(saved.departmentId), saved);
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      if (department) {
        void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
        void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
        void queryClient.invalidateQueries({ queryKey: timeOffKeys.all });
        queryClient.setQueryData<SessionUser | null>(sessionKey, (current) => {
          if (!current || current.employee.department?.departmentId !== saved.departmentId) return current;
          return {
            ...current,
            employee: {
              ...current.employee,
              department: { departmentId: saved.departmentId, departmentName: saved.departmentName },
            },
          };
        });
      }
      setOpen(false);
      toast.success(department ? "Department updated" : "Department created");
    },
  });
  const { register } = form.form;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(department)); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{department ? `Edit ${department.departmentName}` : "New department"}</DialogTitle>
          <DialogDescription>Department names must be unique across the organization.</DialogDescription>
        </DialogHeader>
        <Form api={form}>
          <Field name="departmentName" label="Department name" required>
            {(control) => <Input {...control} {...register("departmentName")} />}
          </Field>
          <Field name="description" label="Description">
            {(control) => <Textarea {...control} rows={4} {...register("description")} />}
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={form.isSubmitting}>{department ? "Save changes" : "Create department"}</SubmitButton>
          </FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
