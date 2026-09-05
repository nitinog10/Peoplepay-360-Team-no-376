import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type {
  Contract,
  Employee,
  EmployeeStatus,
  EmployeeSummary,
  ListQuery,
  Paginated,
  ScheduleAssignment,
} from "./types";

/** The `toOrderBy` allow-list in `src/modules/employees/service.ts`. */
export const EMPLOYEE_SORTS = [
  "employeeId", "firstName", "lastName", "email", "hireDate", "status", "jobTitle",
] as const;

export const EMPLOYEE_FIELDS = [
  "firstName", "lastName", "email", "phone", "dateOfBirth", "address", "hireDate",
  "terminationDate", "departmentId", "jobTitle", "managerId", "status",
] as const;

export type ListEmployeesQuery = ListQuery & {
  departmentId?: number;
  managerId?: number;
  status?: EmployeeStatus;
};

/**
 * What a create accepts — the presented `Employee` is a different shape (it adds
 * `fullName`, nests `department`/`manager`/`user`), so it must not be posted back.
 * Dates go up as `YYYY-MM-DD`; `dateOnly` in `src/lib/validation.ts` also accepts
 * a full ISO instant.
 */
export interface EmployeeBody {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  hireDate: string;
  terminationDate?: string | null;
  departmentId?: number | null;
  jobTitle?: string | null;
  managerId?: number | null;
  status?: EmployeeStatus;
}

export interface CreateScheduleAssignmentBody {
  scheduleId: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  closePrevious?: boolean;
}

export type UpdateScheduleAssignmentBody = Omit<Partial<CreateScheduleAssignmentBody>, "closePrevious">;

export const employeeKeys = {
  all: ["employees"] as const,
  list: (query: ListEmployeesQuery) => ["employees", "list", query] as const,
  detail: (id: number) => ["employees", "detail", id] as const,
  summary: (id: number | "me") => ["employees", "summary", id] as const,
  me: ["employees", "me"] as const,
  mySchedule: ["employees", "me", "schedule"] as const,
  contracts: (id: number, query: ListQuery) =>
    ["employees", "contracts", id, query] as const,
  assignments: (id: number) => ["employees", "assignments", id] as const,
};

/**
 * `list` is scoped, not forbidden: an EMPLOYEE calling it gets a one-row page
 * containing themselves (`scopeToEmployee` in `src/auth/permissions.ts`), so a
 * roster screen must gate on `employees:write` rather than on an empty result.
 */
export const employees = {
  list: (query: ListEmployeesQuery = {}) =>
    queryOptions({
      queryKey: employeeKeys.list(query),
      queryFn: ({ signal }) =>
        http.get<Paginated<Employee>>("/employees", { query, signal }),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: employeeKeys.detail(id),
      queryFn: ({ signal }) => http.get<Employee>(`/employees/${id}`, { signal }),
    }),

  me: () =>
    queryOptions({
      queryKey: employeeKeys.me,
      queryFn: ({ signal }) => http.get<Employee>("/employees/me", { signal }),
    }),

  mySchedule: () =>
    queryOptions({
      queryKey: employeeKeys.mySchedule,
      queryFn: ({ signal }) =>
        http.get<ScheduleAssignment | null>("/employees/me/schedule", { signal }),
    }),

  summary: (id: number | "me" = "me") =>
    queryOptions({
      queryKey: employeeKeys.summary(id),
      queryFn: ({ signal }) =>
        http.get<EmployeeSummary>(
          id === "me" ? "/employees/me/summary" : `/employees/${id}/summary`,
          { signal },
        ),
    }),

  contracts: (id: number, query: ListQuery = {}) =>
    queryOptions({
      queryKey: employeeKeys.contracts(id, query),
      queryFn: ({ signal }) =>
        http.get<Paginated<Contract>>(`/employees/${id}/contracts`, { query, signal }),
    }),

  assignments: (id: number) =>
    queryOptions({
      queryKey: employeeKeys.assignments(id),
      queryFn: ({ signal }) =>
        http.get<{ data: ScheduleAssignment[] }>(
          `/employees/${id}/schedule-assignments`,
          { signal },
        ),
    }),

  createAssignment: (employeeId: number, body: CreateScheduleAssignmentBody) =>
    http.post<ScheduleAssignment>(`/employees/${employeeId}/schedule-assignments`, body),

  updateAssignment: (assignmentId: number, body: UpdateScheduleAssignmentBody) =>
    http.patch<ScheduleAssignment>(`/schedule-assignments/${assignmentId}`, body),

  removeAssignment: (assignmentId: number) =>
    http.delete<void>(`/schedule-assignments/${assignmentId}`),

  create: (body: EmployeeBody) => http.post<Employee>("/employees", body),

  update: (id: number, body: Partial<EmployeeBody>) =>
    http.patch<Employee>(`/employees/${id}`, body),

  /** Sets the termination date and flips the status; keeps the row. */
  terminate: (id: number, body: { terminationDate?: string } = {}) =>
    http.post<Employee>(`/employees/${id}/terminate`, body),

  remove: (id: number) => http.delete<void>(`/employees/${id}`),
};
