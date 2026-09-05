"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LayoutGridIcon, PlusIcon, TableIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { Kanban } from "@/components/kanban";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListParams } from "@/hooks/use-list-params";
import { api, type Employee, type EmployeeStatus } from "@/lib/api";
import { formatDate } from "@/lib/format";

const STATUSES: readonly EmployeeStatus[] = ["ACTIVE", "INACTIVE", "TERMINATED"];

const COLUMNS: readonly Column<Employee>[] = [
  {
    key: "lastName",
    header: "Name",
    sortable: true,
    cell: (employee) => <span className="font-medium">{employee.fullName}</span>,
  },
  {
    key: "email",
    header: "Email",
    sortable: true,
    hideBelow: "sm",
    cell: (employee) => <span className="text-muted-foreground">{employee.email}</span>,
  },
  {
    key: "jobTitle",
    header: "Job title",
    sortable: true,
    hideBelow: "md",
    cell: (employee) => employee.jobTitle ?? "—",
  },
  {
    key: "department",
    header: "Department",
    hideBelow: "lg",
    cell: (employee) => employee.department?.departmentName ?? "—",
  },
  {
    key: "manager",
    header: "Manager",
    hideBelow: "lg",
    cell: (employee) => employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "—",
  },
  {
    key: "hireDate",
    header: "Hired",
    sortable: true,
    align: "end",
    hideBelow: "md",
    cell: (employee) => formatDate(employee.hireDate),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    cell: (employee) => <StatusBadge status={employee.status} />,
  },
];

function initials(employee: Employee): string {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
}

function optionId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function employeeStatus(value: string | undefined): EmployeeStatus | undefined {
  return STATUSES.find((status) => status === value);
}

export function EmployeesList() {
  const router = useRouter();
  const list = useListParams({ sort: "lastName" });
  const view = list.filters.view === "list" ? "list" : "kanban";

  const departments = useQuery(
    api.departments.list({ pageSize: 100, sort: "departmentName", order: "asc" }),
  );
  const managers = useQuery(
    api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }),
  );
  const employees = useQuery({
    ...api.employees.list({
      ...list.params,
      departmentId: optionId(list.filters.departmentId),
      managerId: optionId(list.filters.managerId),
      status: employeeStatus(list.filters.status),
    }),
    placeholderData: keepPreviousData,
  });

  const filters: readonly FilterDef[] = [
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
      options: STATUSES.map((status) => ({
        value: status,
        label: status.charAt(0) + status.slice(1).toLowerCase(),
      })),
    },
    {
      kind: "select",
      key: "managerId",
      label: "Manager",
      allLabel: "All managers",
      options: (managers.data?.data ?? []).map((manager) => ({
        value: String(manager.employeeId),
        label: manager.fullName,
      })),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader
        title="Employees"
        description="Browse the workforce by department or switch to a sortable roster."
      >
        <Button asChild>
          <Link href="/employees/new"><PlusIcon /> New employee</Link>
        </Button>
      </PageHeader>

      <FilterBar
        list={list}
        filters={filters}
        searchPlaceholder="Name, email, job title…"
      >
        <div className="flex gap-1">
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={view === "list"}
            onClick={() => list.setFilter("view", "list")}
          >
            <TableIcon /> List
          </Button>
          <Button
            type="button"
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={view === "kanban"}
            onClick={() => list.setFilter("view", null)}
          >
            <LayoutGridIcon /> Kanban
          </Button>
        </div>
      </FilterBar>

      {view === "kanban" ? (
        departments.isPending ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : departments.error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center">
            <div>
              <p className="font-medium">Departments could not be loaded</p>
              <p className="text-sm text-muted-foreground">The department board needs its column list.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void departments.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <Kanban
            query={employees}
            list={list}
            rowKey={(employee) => employee.employeeId}
            groups={(departments.data?.data ?? []).map((department) => ({
              key: String(department.departmentId),
              label: department.departmentName,
            }))}
            groupOf={(employee) => employee.departmentId}
            unassignedLabel="No department"
            onCardClick={(employee) => router.push(`/employees/${employee.employeeId}`)}
            empty={{
              title: "No employees found",
              description: "Adjust the filters or create the first matching employee.",
              action: <Button asChild><Link href="/employees/new">New employee</Link></Button>,
            }}
            renderCard={(employee) => (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                    {initials(employee)}
                  </span>
                  <span className="truncate font-medium">{employee.fullName}</span>
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {employee.jobTitle ?? "No job title"}
                </span>
                <StatusBadge status={employee.status} className="self-start" />
              </div>
            )}
          />
        )
      ) : (
        <DataTable
          columns={COLUMNS}
          query={employees}
          list={list}
          rowKey={(employee) => employee.employeeId}
          caption="Employees"
          onRowClick={(employee) => router.push(`/employees/${employee.employeeId}`)}
          empty={{
            title: "No employees found",
            description: "Adjust the filters or create the first matching employee.",
            action: <Button asChild><Link href="/employees/new">New employee</Link></Button>,
          }}
        />
      )}
    </div>
  );
}
