"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGridIcon, TableIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";

import { RequireSession } from "@/components/auth/require-session";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { Field, Form, FormActions, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Kanban } from "@/components/kanban";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useListParams } from "@/hooks/use-list-params";
import { api, departmentKeys, type Employee, type EmployeeStatus } from "@/lib/api";
import { DEPARTMENT_FIELDS } from "@/lib/api/departments";
import { formatDate } from "@/lib/format";

/** `key` doubles as the API's `?sort=` value, so each one is in `EMPLOYEE_SORTS`. */
const COLUMNS: readonly Column<Employee>[] = [
  {
    key: "lastName",
    header: "Name",
    sortable: true,
    cell: (row) => <span className="font-medium">{row.fullName}</span>,
  },
  {
    key: "email",
    header: "Email",
    sortable: true,
    hideBelow: "sm",
    cell: (row) => <span className="text-muted-foreground">{row.email}</span>,
  },
  {
    key: "jobTitle",
    header: "Job title",
    sortable: true,
    hideBelow: "md",
    cell: (row) => row.jobTitle ?? "—",
  },
  {
    key: "department",
    header: "Department",
    hideBelow: "lg",
    cell: (row) => row.department?.departmentName ?? "—",
  },
  {
    key: "hireDate",
    header: "Hired",
    sortable: true,
    align: "end",
    hideBelow: "md",
    cell: (row) => formatDate(row.hireDate),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    cell: (row) => <StatusBadge status={row.status} />,
  },
];

const STATUSES: EmployeeStatus[] = ["ACTIVE", "INACTIVE", "TERMINATED"];

function initials(employee: Employee): string {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
}

/** Client-side rules only; the server owns uniqueness, which is the point below. */
const departmentSchema = z.object({
  departmentName: z.string().trim().min(2, "Give the department a name").max(120),
  description: z.string().trim().max(255).optional(),
});

type DepartmentValues = z.infer<typeof departmentSchema>;

/**
 * The 409 half of the gate: `Engineering` is seeded, so submitting it unchanged
 * makes the API answer `UNIQUE_VIOLATION`, and `ApiError.fieldErrors()` matches
 * `departments_department_name_key` back to the `departmentName` input.
 */
function DepartmentForm() {
  const queryClient = useQueryClient();
  const create = useApiForm({
    schema: departmentSchema,
    defaultValues: { departmentName: "Engineering", description: "" },
    fields: DEPARTMENT_FIELDS,
    submit: (values: DepartmentValues) =>
      api.departments.create({
        departmentName: values.departmentName,
        description: values.description?.trim() ? values.description : null,
      }),
    onSuccess: (department) => {
      toast.success(`Created ${department.departmentName}`);
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });

  const { register } = create.form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Department form</CardTitle>
        <CardDescription>
          Submit as-is: <code className="font-mono text-xs">Engineering</code> already exists, so
          the server&rsquo;s 409 lands on the name field and in the banner. Change the name and it
          creates — submit that twice and the second attempt is a duplicate too.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form api={create}>
          <FormGrid>
            <Field name="departmentName" label="Department name" required>
              {(control) => <Input {...control} {...register("departmentName")} />}
            </Field>
            <Field name="description" label="Description" description="Optional, 255 characters.">
              {(control) => <Textarea {...control} rows={2} {...register("description")} />}
            </Field>
          </FormGrid>
          <FormActions>
            <Button type="button" variant="ghost" onClick={() => create.form.reset()}>
              Reset
            </Button>
            <SubmitButton pending={create.isSubmitting}>Create department</SubmitButton>
          </FormActions>
        </Form>
      </CardContent>
    </Card>
  );
}

function EmployeesPanel() {
  const list = useListParams({ sort: "lastName" });
  const search = useSearchParams();

  const departments = useQuery(
    api.departments.list({ pageSize: 100, sort: "departmentName" }),
  );

  const employees = useQuery({
    ...api.employees.list({
      ...list.params,
      departmentId: list.filters.departmentId ? Number(list.filters.departmentId) : undefined,
      status: (list.filters.status as EmployeeStatus | undefined) ?? undefined,
    }),
    // Paging keeps the current rows on screen (dimmed) rather than flashing skeletons.
    placeholderData: keepPreviousData,
  });

  const filters: FilterDef[] = [
    {
      kind: "select",
      key: "departmentId",
      label: "Department",
      allLabel: "All departments",
      options: (departments.data?.data ?? []).map((department) => ({
        value: String(department.departmentId),
        label: department.departmentName,
      })),
    },
    {
      kind: "select",
      key: "status",
      label: "Status",
      allLabel: "Any status",
      options: STATUSES.map((status) => ({ value: status, label: status })),
    },
  ];

  const board = list.filters.view === "board";
  const qs = search.toString();

  return (
    <div className="flex flex-col gap-3">
      <FilterBar list={list} filters={filters} searchPlaceholder="Name, email, job title…">
        <div className="flex gap-1">
          <Button
            variant={board ? "ghost" : "secondary"}
            size="sm"
            onClick={() => list.setFilter("view", null)}
          >
            <TableIcon /> Table
          </Button>
          <Button
            variant={board ? "secondary" : "ghost"}
            size="sm"
            onClick={() => list.setFilter("view", "board")}
          >
            <LayoutGridIcon /> Board
          </Button>
        </div>
      </FilterBar>

      <p className="text-xs text-muted-foreground">
        URL state:{" "}
        <code className="font-mono">{qs ? `?${qs}` : "(defaults — nothing in the query string)"}</code>
      </p>

      {board ? (
        <Kanban
          query={employees}
          list={list}
          rowKey={(row) => row.employeeId}
          groups={(departments.data?.data ?? []).map((department) => ({
            key: String(department.departmentId),
            label: department.departmentName,
          }))}
          groupOf={(row) => row.departmentId}
          unassignedLabel="No department"
          renderCard={(row) => (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                  {initials(row)}
                </span>
                <span className="truncate font-medium">{row.fullName}</span>
              </div>
              <span className="truncate text-xs text-muted-foreground">{row.jobTitle ?? "—"}</span>
              <StatusBadge status={row.status} className="self-start" />
            </div>
          )}
        />
      ) : (
        <DataTable
          columns={COLUMNS}
          query={employees}
          list={list}
          rowKey={(row) => row.employeeId}
          caption="Seeded employees, filtered by the controls above"
          onRowClick={(row) => toast.message(row.fullName, { description: row.email })}
        />
      )}
    </div>
  );
}

export function ListsScratch() {
  return (
    <RequireSession>
      <div className="flex flex-col gap-8">
        <PageHeader
          title="List and form primitives"
          description="FE-6's gate: DataTable, FilterBar, Pagination, Kanban and the RHF + zod form wrappers, all reading one URL. Sort a column, search, page, then reload — the table comes back the way you left it."
        />

        <Card>
          <CardHeader>
            <CardTitle>Employees</CardTitle>
            <CardDescription>
              <code className="font-mono text-xs">GET /employees</code> — signed in as HR this is the
              whole roster; as an employee the API scopes it to one row, which is why the real screen
              (P2-1) gates on <code className="font-mono text-xs">employees:write</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeesPanel />
          </CardContent>
        </Card>

        <DepartmentForm />
      </div>
    </RequireSession>
  );
}

