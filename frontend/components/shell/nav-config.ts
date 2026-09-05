import type { LucideIcon } from "lucide-react";
import {
  BanknoteIcon,
  Building2Icon,
  CalendarClockIcon,
  ClockIcon,
  FileTextIcon,
  HouseIcon,
  LayoutDashboardIcon,
  PlaneIcon,
  TagsIcon,
  ShieldCheckIcon,
  UserCogIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import type { Permission } from "@/lib/api";

/**
 * The navigation is data, not JSX, so the sidebar has no role branching in it and
 * every future screen only has to add a row here.
 *
 * **Read the `permission` values carefully.** `*:read` is granted to EMPLOYEE as
 * well — the API scopes their rows instead of refusing — so a link that should be
 * HR-only is gated on the matching `:write` permission. `/contracts` and
 * `/attendance` are deliberately `:read`: an employee sees the same route with
 * their own rows in it.
 */
export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden unless the session carries this permission; omitted = always visible. */
  permission?: Permission;
  /** Highlight only on an exact pathname match (default: prefix, so children light the parent). */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  children: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

export const NAV: NavEntry[] = [
  { label: "My Space", href: "/", icon: HouseIcon, exact: true },
  { label: "My Profile", href: "/employees/me", icon: UserRoundIcon, permission: "employees:read", exact: true },
  {
    label: "Employees",
    icon: UsersIcon,
    children: [
      // The roster itself is HR's; an employee reads their own record at /employees/me.
      { label: "Employees", href: "/employees", icon: UsersIcon, permission: "employees:write" },
      { label: "Users", href: "/users", icon: UserCogIcon, permission: "users:manage" },
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheckIcon, permission: "roles:read" },
      { label: "Contracts", href: "/contracts", icon: FileTextIcon, permission: "contracts:read" },
      {
        label: "Departments",
        href: "/departments",
        icon: Building2Icon,
        permission: "departments:write",
      },
      {
        label: "Working Schedules",
        href: "/work-schedules",
        icon: CalendarClockIcon,
        permission: "work-schedules:write",
      },
    ],
  },
  { label: "Attendance", href: "/attendance", icon: ClockIcon, permission: "attendance:read" },
  {
    label: "Time Off",
    icon: PlaneIcon,
    children: [
      {
        label: "Dashboard",
        href: "/time-off",
        icon: LayoutDashboardIcon,
        permission: "time-off:read",
        exact: true,
      },
      {
        label: "Requests",
        href: "/time-off/requests",
        icon: FileTextIcon,
        permission: "time-off:read",
      },
      {
        label: "Allocations",
        href: "/time-off/balances",
        icon: WalletIcon,
        permission: "leave-balances:read",
      },
      { label: "Types", href: "/time-off/types", icon: TagsIcon, permission: "leave-types:write" },
    ],
  },
  {
    label: "Payroll",
    icon: BanknoteIcon,
    children: [
      { label: "Dashboard", href: "/payroll/dashboard", icon: LayoutDashboardIcon, permission: "payroll:read", exact: true },
      { label: "Payruns", href: "/payroll/payruns", icon: BanknoteIcon, permission: "payroll:read" },
      { label: "Payslips", href: "/payroll/payslips", icon: FileTextIcon, permission: "payroll:read" },
      { label: "Salary Structures", href: "/payroll/structures", icon: WalletIcon, permission: "salary-config:read" },
      { label: "Salary Rules", href: "/payroll/rules", icon: TagsIcon, permission: "salary-config:read" },
    ],
  },
];
