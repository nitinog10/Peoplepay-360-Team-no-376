"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";

import { UserFormDrawer } from "@/app/(app)/users/user-form-drawer";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListParams } from "@/hooks/use-list-params";
import { api, type ManagedUser, type RoleName } from "@/lib/api";
import { useSession } from "@/lib/auth/session";
import { formatDateTime, formatRoleName } from "@/lib/format";

const ROLES: readonly RoleName[] = ["EMPLOYEE", "HR_MANAGER", "HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"];

const COLUMNS: readonly Column<ManagedUser>[] = [
  { key: "username", header: "Username", sortable: true, cell: (user) => <span className="font-medium">{user.username}</span> },
  { key: "employee", header: "Employee", cell: (user) => `${user.employee.firstName} ${user.employee.lastName}` },
  { key: "email", header: "Work email", hideBelow: "md", cell: (user) => <span className="text-muted-foreground">{user.employee.email}</span> },
  { key: "role", header: "Role", cell: (user) => <Badge variant="secondary">{formatRoleName(user.role)}</Badge> },
  { key: "active", header: "Status", cell: (user) => <StatusBadge status={user.isActive ? "ACTIVE" : "INACTIVE"} /> },
  { key: "lastLoginAt", header: "Last login", sortable: true, align: "end", hideBelow: "lg", cell: (user) => user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never" },
];

function roleValue(value: string | undefined): RoleName | undefined {
  return ROLES.find((role) => role === value);
}

function activeValue(value: string | undefined): boolean | undefined {
  return value === "true" ? true : value === "false" ? false : undefined;
}

export function UsersList() {
  const session = useSession();
  const list = useListParams({ sort: "username" });
  const roles = useQuery(api.users.roles());
  const query = useQuery({
    ...api.users.list({
      ...list.params,
      role: roleValue(list.filters.role),
      isActive: activeValue(list.filters.isActive),
    }),
    placeholderData: keepPreviousData,
  });
  const filters: readonly FilterDef[] = [
    {
      kind: "select",
      key: "role",
      label: "Role",
      allLabel: "All roles",
      options: (roles.data?.data ?? []).map((role) => ({ value: role.roleName, label: formatRoleName(role.roleName) })),
    },
    {
      kind: "select",
      key: "isActive",
      label: "Account status",
      allLabel: "Any status",
      options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }],
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader
        title="User Management"
        description={session.user?.role === "ADMIN"
          ? "Create logins and manage usernames, passwords, roles, and account access across all five roles."
          : "Create and manage Employee-role logins. Your own username and password remain editable."}
      >
        <UserFormDrawer trigger={<Button><PlusIcon /> New user</Button>} />
      </PageHeader>
      <FilterBar list={list} filters={filters} search searchPlaceholder="Username, employee, or email…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(user) => user.userId}
        caption="User accounts"
        rowActions={(user) => {
          const canManage = session.user?.role === "ADMIN" || user.userId === session.user?.userId || user.role === "EMPLOYEE";
          return canManage ? (
            <UserFormDrawer user={user} trigger={<Button type="button" variant="ghost" size="icon-sm" title="Edit user"><PencilIcon /><span className="sr-only">Edit</span></Button>} />
          ) : null;
        }}
        empty={{ title: "No user accounts", description: "Create an account for an eligible employee." }}
      />
    </div>
  );
}
