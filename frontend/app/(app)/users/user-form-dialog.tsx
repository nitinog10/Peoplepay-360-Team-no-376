"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sessionKey, useSession } from "@/lib/auth/session";
import { api, employeeKeys, userKeys, type CreateUserBody, type ManagedUser, type UpdateUserBody } from "@/lib/api";

const username = z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._@-]+$/, "Username may contain letters, numbers, dots, underscores, @ and dashes");
const assignableRole = z.enum(["EMPLOYEE", "HR_MANAGER", "HR_PAYROLL_USER", "HR_PAYROLL_MANAGER"]);
const createSchema = z.object({
  employeeId: z.string().min(1, "Select an employee"),
  username,
  password: z.string().min(8).max(200),
  role: assignableRole,
  isActive: z.boolean(),
});
const editSchema = z.object({
  employeeId: z.string(),
  username,
  password: z.string().max(200).refine((value) => value.length === 0 || value.length >= 8, "Password must be at least 8 characters"),
  role: assignableRole,
  isActive: z.boolean(),
});

type Values = z.infer<typeof createSchema>;
type AssignableRole = Values["role"];

function roleLabel(role: AssignableRole): string {
  if (role === "HR_MANAGER") return "HR Manager";
  if (role === "HR_PAYROLL_USER") return "HR Payroll User";
  if (role === "HR_PAYROLL_MANAGER") return "HR Payroll Manager";
  return "Employee";
}

function defaults(user?: ManagedUser): Values {
  return {
    employeeId: user ? String(user.employeeId) : "",
    username: user?.username ?? "",
    password: "",
    role: user && ["EMPLOYEE", "HR_MANAGER", "HR_PAYROLL_USER", "HR_PAYROLL_MANAGER"].includes(user.role) ? user.role as AssignableRole : "EMPLOYEE",
    isActive: user?.isActive ?? true,
  };
}

export function UserFormDialog({ user, trigger }: { user?: ManagedUser; trigger: React.ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const isSelf = user?.userId === session.user?.userId;
  const employees = useQuery({
    ...api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }),
    enabled: open && !user,
  });
  const roles = useQuery({ ...api.users.roles(), enabled: open });
  const eligibleEmployees = (employees.data?.data ?? []).filter((employee) => !employee.user && employee.status !== "TERMINATED");

  const form = useApiForm<Values, ManagedUser>({
    schema: user ? editSchema : createSchema,
    defaultValues: defaults(user),
    fields: user ? ["username", "password", "role", "isActive"] : ["employeeId", "username", "password", "role"],
    submit: (values) => {
      if (!user) {
        const body: CreateUserBody = {
          employeeId: Number(values.employeeId),
          username: values.username.trim(),
          password: values.password,
          role: values.role,
        };
        return api.users.create(body);
      }
      const body: UpdateUserBody = {
        username: values.username.trim(),
        ...(values.password ? { password: values.password } : {}),
        ...(!isSelf ? { role: values.role, isActive: values.isActive } : {}),
      };
      return api.users.update(user.userId, body);
    },
    onApiError: (error, formApi) => {
      if (!user && error.message === "This employee already has a user account") {
        formApi.setError("employeeId", { type: "server", message: error.message });
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(userKeys.detail(saved.userId), saved);
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
      if (saved.userId === session.user?.userId) {
        void queryClient.invalidateQueries({ queryKey: sessionKey });
      }
      setOpen(false);
      toast.success(user ? "User account updated" : "User account created");
    },
  });

  const selectedEmployeeId = form.form.watch("employeeId");
  const selectedRole = form.form.watch("role");
  const active = form.form.watch("isActive");
  const { register } = form.form;

  function selectEmployee(value: string) {
    form.form.setValue("employeeId", value, { shouldDirty: true, shouldValidate: true });
    const employee = eligibleEmployees.find((candidate) => candidate.employeeId === Number(value));
    if (employee) form.form.setValue("username", employee.email, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); form.setFormError(null); if (next) form.form.reset(defaults(user)); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.username}` : "Create user account"}</DialogTitle>
          <DialogDescription>
            {user ? "A new password is optional. Password changes and deactivation revoke refresh sessions." : "Link one non-terminated employee to a login and assign its access role."}
          </DialogDescription>
        </DialogHeader>
        <Form api={form}>
          {!user && (
            <Field name="employeeId" label="Employee" required>
              {(control) => (
                <Select value={selectedEmployeeId || undefined} onValueChange={selectEmployee}>
                  <SelectTrigger {...control} className="w-full"><SelectValue placeholder={employees.isPending ? "Loading employees…" : "Select employee"} /></SelectTrigger>
                  <SelectContent>
                    {eligibleEmployees.map((employee) => (
                      <SelectItem key={employee.employeeId} value={String(employee.employeeId)}>{employee.fullName} · {employee.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}
          <FormGrid>
            <Field name="username" label="Username" required>
              {(control) => <Input {...control} autoComplete="off" {...register("username")} />}
            </Field>
            <Field name="password" label={user ? "New password" : "Password"} required={!user} description={user ? "Leave blank to keep the current password." : "8–200 characters."}>
              {(control) => <Input {...control} type="password" autoComplete="new-password" {...register("password")} />}
            </Field>
          </FormGrid>
          {!isSelf ? (
            <FormGrid>
              <Field name="role" label="Role" required>
                {(control) => (
                  <Select value={selectedRole} onValueChange={(value) => form.form.setValue("role", value as AssignableRole, { shouldDirty: true, shouldValidate: true })}>
                    <SelectTrigger {...control} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(roles.data?.data ?? []).map((role) => <SelectItem key={role.roleId} value={role.roleName}>{roleLabel(role.roleName as AssignableRole)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              {user && (
                <Field name="isActive" label="Account status">
                  {(control) => (
                    <Label {...control} className="flex h-8 items-center gap-2 rounded-lg border px-3 font-normal">
                      <Checkbox checked={active} onCheckedChange={(checked) => form.form.setValue("isActive", checked === true, { shouldDirty: true })} />
                      Active login
                    </Label>
                  )}
                </Field>
              )}
            </FormGrid>
          ) : (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">You can change your own username or password, but not your role or active state.</p>
          )}
          {user && !isSelf && (
            <p className="text-xs text-muted-foreground">Role changes take full effect when the user’s current access token expires or refreshes. Deactivation blocks login and refresh, but an existing access token remains valid until expiry.</p>
          )}
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={form.isSubmitting} disabled={!user && (!selectedEmployeeId || roles.isPending)}>{user ? "Save changes" : "Create account"}</SubmitButton>
          </FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
