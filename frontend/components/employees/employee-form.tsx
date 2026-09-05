"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { EmployeeActions } from "@/components/employees/employee-actions";
import {
  EmployeeDetails,
  type EmployeeEditableField,
} from "@/components/employees/employee-details";
import { Form, SubmitButton, useApiForm } from "@/components/form";
import { AssignmentHistory } from "@/components/schedules/assignment-history";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import { sessionKey } from "@/lib/auth/session";
import {
  ApiError,
  api,
  departmentKeys,
  employeeKeys,
  type Employee,
  type EmployeeStatus,
  type SessionUser,
} from "@/lib/api";
import { EMPLOYEE_FIELDS, type EmployeeBody } from "@/lib/api/employees";
import { todayDateOnly, toDateOnly } from "@/lib/format";

const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  email: z.string().trim().email("Enter a valid email").max(150),
  phone: z.string().trim().max(20),
  dateOfBirth: z.string(),
  address: z.string().trim().max(5000),
  hireDate: z.string().min(1, "Hire date is required"),
  departmentId: z.string(),
  jobTitle: z.string().trim().max(100),
  managerId: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]),
});

type EmployeeValues = z.infer<typeof employeeSchema>;

function defaults(employee?: Employee): EmployeeValues {
  return {
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    dateOfBirth: employee?.dateOfBirth ? toDateOnly(employee.dateOfBirth) : "",
    address: employee?.address ?? "",
    hireDate: employee ? toDateOnly(employee.hireDate) : todayDateOnly(),
    departmentId: employee?.departmentId ? String(employee.departmentId) : "",
    jobTitle: employee?.jobTitle ?? "",
    managerId: employee?.managerId ? String(employee.managerId) : "",
    status: employee?.status ?? "ACTIVE",
  };
}

function optionalId(value: string): number | null {
  return value ? Number(value) : null;
}

function bodyOf(values: EmployeeValues): EmployeeBody {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim() || null,
    dateOfBirth: values.dateOfBirth || null,
    address: values.address.trim() || null,
    hireDate: values.hireDate,
    departmentId: optionalId(values.departmentId),
    jobTitle: values.jobTitle.trim() || null,
    managerId: optionalId(values.managerId),
    status: values.status,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Employee data could not be loaded.";
}

function fieldMessages(errors: Record<string, unknown>): Partial<Record<EmployeeEditableField, string>> {
  const result: Partial<Record<EmployeeEditableField, string>> = {};
  for (const [field, value] of Object.entries(errors)) {
    const message = (value as { message?: unknown } | undefined)?.message;
    if (typeof message === "string") result[field as EmployeeEditableField] = message;
  }
  return result;
}

export function EmployeeForm({ mode, employeeId }: { mode: "create" | "edit"; employeeId?: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const initialized = useRef(false);

  const detail = useQuery({
    ...api.employees.detail(employeeId ?? 0),
    enabled: mode === "edit" && Boolean(employeeId),
  });
  const summary = useQuery({
    ...api.employees.summary(employeeId ?? 0),
    enabled: mode === "edit" && Boolean(employeeId),
  });
  const departments = useQuery(
    api.departments.list({ pageSize: 100, sort: "departmentName", order: "asc" }),
  );
  const managers = useQuery(
    api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }),
  );

  const formApi = useApiForm<EmployeeValues, Employee>({
    schema: employeeSchema,
    defaultValues: defaults(),
    fields: EMPLOYEE_FIELDS,
    submit: (values) => mode === "create"
      ? api.employees.create(bodyOf(values))
      : api.employees.update(employeeId as number, bodyOf(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(employeeKeys.detail(saved.employeeId), saved);
      void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });

      if (user?.employee.employeeId === saved.employeeId) {
        queryClient.setQueryData<SessionUser | null>(sessionKey, (current) => current ? {
          ...current,
          employee: {
            ...current.employee,
            firstName: saved.firstName,
            lastName: saved.lastName,
            email: saved.email,
            jobTitle: saved.jobTitle,
            departmentId: saved.departmentId,
            department: saved.department,
            status: saved.status,
          },
        } : current);
      }

      formApi.form.reset(defaults(saved));
      toast.success(mode === "create" ? `${saved.fullName} was created` : "Employee changes saved");
      if (mode === "create") router.replace(`/employees/${saved.employeeId}`);
    },
  });

  useEffect(() => {
    if (mode === "edit" && detail.data && !initialized.current) {
      initialized.current = true;
      formApi.form.reset(defaults(detail.data));
    }
  }, [detail.data, formApi.form, mode]);

  const values = formApi.form.watch();
  const departmentRows = useMemo(() => departments.data?.data ?? [], [departments.data?.data]);
  const managerRows = useMemo(
    () => (managers.data?.data ?? []).filter((manager) => manager.status !== "TERMINATED"),
    [managers.data?.data],
  );

  const presented = useMemo<Employee>(() => {
    const original = detail.data;
    const department = departmentRows.find((item) => String(item.departmentId) === values.departmentId);
    const manager = managerRows.find((item) => String(item.employeeId) === values.managerId);
    const timestamp = new Date().toISOString();
    const status = values.status as EmployeeStatus;
    return {
      employeeId: original?.employeeId ?? 0,
      firstName: values.firstName,
      lastName: values.lastName,
      fullName: `${values.firstName} ${values.lastName}`.trim() || "New employee",
      email: values.email,
      phone: values.phone || null,
      dateOfBirth: values.dateOfBirth || null,
      address: values.address || null,
      hireDate: values.hireDate || todayDateOnly(),
      terminationDate: original?.terminationDate ?? null,
      departmentId: optionalId(values.departmentId),
      jobTitle: values.jobTitle || null,
      managerId: optionalId(values.managerId),
      status,
      createdAt: original?.createdAt ?? timestamp,
      updatedAt: original?.updatedAt ?? timestamp,
      department: department ? {
        departmentId: department.departmentId,
        departmentName: department.departmentName,
      } : null,
      manager: manager ? {
        employeeId: manager.employeeId,
        firstName: manager.firstName,
        lastName: manager.lastName,
        email: manager.email,
      } : null,
      user: original?.user ?? null,
    };
  }, [departmentRows, detail.data, managerRows, values]);

  if (mode === "edit" && detail.isPending) {
    return <div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-96" /></div>;
  }
  if (mode === "edit" && detail.error) {
    return (
      <div className="mx-auto flex w-full max-w-content flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="font-medium">{errorMessage(detail.error)}</p>
        <Button type="button" variant="outline" onClick={() => void detail.refetch()}>Try again</Button>
      </div>
    );
  }

  const lookupError = departments.error ?? managers.error;
  const isSelf = mode === "edit" && user?.employee.employeeId === employeeId;
  const messages = fieldMessages(formApi.form.formState.errors as Record<string, unknown>);
  const optionsPending = departments.isPending || managers.isPending;

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      {lookupError ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center">
          <p className="font-medium">{errorMessage(lookupError)}</p>
          <Button type="button" variant="outline" onClick={() => { void departments.refetch(); void managers.refetch(); }}>Retry employee options</Button>
        </div>
      ) : (
        <>
          <Form api={formApi}>
          <EmployeeDetails
            employee={presented}
            summary={summary.data}
            readOnly={false}
            create={mode === "create"}
            departments={departmentRows.map((department) => ({ value: String(department.departmentId), label: department.departmentName }))}
            managers={managerRows.map((manager) => ({ value: String(manager.employeeId), label: manager.fullName }))}
            disableStatus={Boolean(isSelf)}
            errors={messages}
            onChange={(field, value) => formApi.form.setValue(field, value, { shouldDirty: true, shouldValidate: true })}
            actions={
              <>
                <Button asChild type="button" variant="outline"><Link href="/employees">Back</Link></Button>
                <SubmitButton pending={formApi.isSubmitting} disabled={optionsPending}>
                  {mode === "create" ? "Create employee" : "Save changes"}
                </SubmitButton>
                {mode === "edit" && detail.data && summary.data && (
                  <EmployeeActions
                    employee={detail.data}
                    directReports={summary.data.counts.directReports}
                    isSelf={Boolean(isSelf)}
                    onChanged={(updated) => formApi.form.reset(defaults(updated))}
                  />
                )}
              </>
            }
          />
          </Form>
          {mode === "edit" && detail.data && (
            <AssignmentHistory
              employeeId={detail.data.employeeId}
              terminated={detail.data.status === "TERMINATED"}
            />
          )}
        </>
      )}
    </div>
  );
}
