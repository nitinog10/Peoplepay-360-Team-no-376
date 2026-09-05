/**
 * Hand-mirrored copies of the API's response shapes.
 *
 * The backend ships no OpenAPI document, so these are transcribed from the
 * presenters in `ts-backend/src/modules/*` and checked against live responses.
 * Three things are easy to get wrong:
 *
 * - Prisma `Decimal` columns arrive as JSON **numbers**, not strings:
 *   `src/lib/prisma.ts` overrides `Decimal.prototype.toJSON`.
 * - Presenters add fields backed by no column (`fullName`, `employeeCount`,
 *   `remainingDays`, `isCurrent`, …). They are part of the contract.
 * - Dates arrive as strings; `JSON.parse` does not revive them.
 */

/** Full ISO-8601 instant, e.g. `2026-09-05T09:14:22.000Z`. */
export type DateTimeString = string;
/**
 * A date-only column: midnight UTC, e.g. `2026-09-05T00:00:00.000Z`.
 *
 * Note the asymmetry — the API *sends* the full instant but its `?date=`/`?from=`
 * filters only *accept* `YYYY-MM-DD`, so pass one of these back through
 * `toDateOnly()` in `lib/format.ts` rather than straight into a query.
 */
export type DateString = string;
/** `HH:MM` — the work-schedule presenter formats times before sending them. */
export type TimeString = string;

// ---------- envelopes ----------

/** `listResponse()` in `src/lib/http.ts`. */
export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

/**
 * `paginationSchema` in `src/lib/http.ts`; `sort` is allow-listed per module.
 *
 * A type alias, not an `interface`, and every module's list query must extend it by
 * intersection (`ListQuery & { … }`) for the same reason: TypeScript infers an index
 * signature for object type aliases but never for interfaces, and without one these
 * cannot be handed to `client.ts`'s `query` parameter.
 */
export type ListQuery = {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
  q?: string;
};

/** Every non-2xx body is `{ error: { code, message, details? } }`. */
export type ApiErrorCode =
  | "BAD_REQUEST" | "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN"
  | "NOT_FOUND" | "CONFLICT" | "UNIQUE_VIOLATION" | "FOREIGN_KEY_VIOLATION"
  | "BUSINESS_RULE_VIOLATION" | "INTERNAL_ERROR";

/** `details` of a 400 VALIDATION_ERROR: one entry per failed Zod issue. */
export interface ValidationDetail {
  path: string;
  message: string;
}

// ---------- enums (prisma/schema.prisma) ----------

export type RoleName = "EMPLOYEE" | "HR_MANAGER";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";
export type ContractType = "PERMANENT" | "FIXED_TERM" | "INTERNSHIP" | "CONTRACTOR";
export type ContractStatus = "ACTIVE" | "EXPIRED" | "TERMINATED";
export type AttendanceStatus =
  | "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY" | "WEEK_OFF";
export type AttendanceEntryType =
  | "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
export type AttendanceSource = "MANUAL" | "BIOMETRIC" | "MOBILE_APP" | "WEB";
export type TimeOffStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApprovalDecision = "APPROVED" | "REJECTED";

// ---------- auth ----------

/**
 * Mirrors `PERMISSIONS` in `src/auth/permissions.ts`. Kept as a value, not just a
 * type, so nav and route guards can be checked against it at runtime.
 *
 * `*:read` for an EMPLOYEE means "own records only" — the API scopes the rows
 * rather than answering 403, so a screen that must be HR-only has to key off a
 * `:write` permission instead.
 */
export const PERMISSIONS = [
  "users:manage",
  "departments:read", "departments:write",
  "leave-types:read", "leave-types:write",
  "work-schedules:read", "work-schedules:write",
  "employees:read", "employees:write",
  "contracts:read", "contracts:write",
  "attendance:read", "attendance:punch", "attendance:write",
  "leave-balances:read", "leave-balances:write",
  "time-off:read", "time-off:request", "time-off:decide",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface DepartmentRef {
  departmentId: number;
  departmentName: string;
}

/** The employee context stapled to a session by `presentUser()`. */
export interface SessionEmployee {
  employeeId: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  departmentId: number | null;
  status: EmployeeStatus;
  department: DepartmentRef | null;
}

/** `GET /auth/me`, and the `user` of a login or refresh. */
export interface SessionUser {
  userId: number;
  username: string;
  role: RoleName;
  isActive: boolean;
  lastLoginAt: DateTimeString | null;
  employee: SessionEmployee;
  permissions: Permission[];
}

/**
 * `POST /auth/login` and `POST /auth/refresh`.
 *
 * `refreshToken` is also set as the httpOnly `pp360_refresh` cookie, scoped to
 * `/api/v1/auth`; the browser client ignores the body copy and lets the cookie
 * ride along instead. Refresh **rotates**: the presented token is revoked.
 */
export interface AuthSession {
  accessToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  tokenType: "Bearer";
  refreshToken: string;
  refreshExpiresAt: DateTimeString;
  user: SessionUser;
}

export interface LoginBody {
  /** Username *or* work email — `src/modules/auth/service.ts` accepts either. */
  username: string;
  password: string;
}

// ---------- user management ----------

export interface Role {
  roleId: number;
  roleName: RoleName;
}

export interface ManagedUser {
  userId: number;
  employeeId: number;
  username: string;
  isActive: boolean;
  lastLoginAt: DateTimeString | null;
  createdAt: DateTimeString;
  role: RoleName;
  employee: {
    employeeId: number;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string | null;
    status: EmployeeStatus;
  };
}

// ---------- departments ----------

export interface Department extends DepartmentRef {
  description: string | null;
  /** Derived: `_count.employees`. */
  employeeCount: number;
}

export interface DepartmentBody {
  departmentName: string;
  description?: string | null;
}

// ---------- employees ----------

export interface EmployeeRef {
  employeeId: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Employee {
  employeeId: number;
  firstName: string;
  lastName: string;
  /** Derived: `firstName + " " + lastName`. */
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: DateString | null;
  address: string | null;
  hireDate: DateString;
  terminationDate: DateString | null;
  departmentId: number | null;
  jobTitle: string | null;
  managerId: number | null;
  status: EmployeeStatus;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
  department: DepartmentRef | null;
  manager: EmployeeRef | null;
  /** Flattened by the presenter; null for an employee with no login. */
  user: { userId: number; username: string; isActive: boolean; role: RoleName } | null;
}

// ---------- work schedules ----------

/**
 * Fully presented — this module does *not* spread the Prisma row, so `startTime`
 * and `endTime` are `"HH:MM"` strings and the hour fields are derived.
 */
export interface WorkSchedule {
  scheduleId: number;
  scheduleName: string;
  /** ISO weekdays, Monday = 1. */
  daysOfWeek: number[];
  startTime: TimeString;
  endTime: TimeString;
  hoursPerDay: number;
  daysPerWeek: number;
  weeklyHours: number;
  description: string | null;
  createdAt: DateTimeString;
  /** Only on list responses (`_count.assignments`). */
  assignmentCount?: number;
}

export interface ScheduleAssignment {
  assignmentId: number;
  employeeId: number;
  scheduleId: number;
  effectiveFrom: DateString;
  effectiveTo: DateString | null;
  createdAt: DateTimeString;
  schedule: WorkSchedule;
}

// ---------- contracts ----------

/** The raw row, as returned inside `EmployeeSummary.activeContract`. */
export interface ContractRow {
  contractId: number;
  employeeId: number;
  contractType: ContractType;
  startDate: DateString;
  endDate: DateString | null;
  /** Decimal(12,2) → number. */
  baseSalary: number | null;
  currency: string | null;
  status: ContractStatus;
  documentUrl: string | null;
  createdBy: number | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface Contract extends ContractRow {
  /** Derived: ACTIVE *and* today falls inside [startDate, endDate]. */
  isCurrent: boolean;
  employee: EmployeeRef & { departmentId: number | null };
  creator: Pick<EmployeeRef, "employeeId" | "firstName" | "lastName"> | null;
}

// ---------- employee summary (`/employees/:id/summary`, `/employees/me/summary`) ----------

export interface EmployeeSummary {
  employee: Employee;
  counts: {
    contracts: number;
    attendance: number;
    timeOffRequests: number;
    pendingTimeOffRequests: number;
    /** Balance rows for the current year only. */
    leaveBalances: number;
    directReports: number;
  };
  activeContract: ContractRow | null;
  currentSchedule: WorkSchedule | null;
}

// ---------- attendance ----------

export interface AttendanceEntry {
  attendanceEntryId: number;
  attendanceRecordId: number;
  entryType: AttendanceEntryType;
  entryTime: DateTimeString;
  source: AttendanceSource;
  createdAt: DateTimeString;
}

/** `derive()` in `src/modules/attendance/derive.ts` — computed, never stored. */
export interface AttendanceDerived {
  state: SessionState;
  isValidSequence: boolean;
  sequenceError?: string;
  firstClockIn: DateTimeString | null;
  lastClockOut: DateTimeString | null;
  /** Closed sessions minus closed breaks. */
  workedHours: number;
  breakHours: number;
  /** Scheduled hours for the day; null without a schedule. */
  expectedHours: number | null;
  overtimeHours: number;
  isLate: boolean;
  lateByMinutes: number;
  /** A past day whose last session was never closed. */
  missingCheckout: boolean;
  /** Minutes elapsed in the currently open session — drives the live timer. */
  elapsedMinutes: number;
  scheduleName: string | null;
}

export type SessionState = "OUT" | "IN" | "ON_BREAK";

export interface AttendanceRecordRow {
  attendanceRecordId: number;
  employeeId: number;
  attendanceDate: DateString;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
  employee: EmployeeRef & {
    department: DepartmentRef | null;
    manager: Pick<EmployeeRef, "employeeId" | "firstName" | "lastName"> | null;
  };
  entries: AttendanceEntry[];
}

/** List and detail responses staple `derived` onto the row. */
export interface AttendanceRecord extends AttendanceRecordRow {
  derived: AttendanceDerived;
}

/**
 * `GET /attendance/session` — today, for the caller.
 *
 * `record` is the bare row (its `derived` sits alongside, not inside), and is
 * null before the first punch of the day. `allowedActions` is the server's view
 * of what the state machine permits next; the widget renders exactly those.
 */
export interface AttendanceSession {
  date: DateString;
  checkedIn: boolean;
  onBreak: boolean;
  state: SessionState;
  allowedActions: AttendanceEntryType[];
  derived: AttendanceDerived;
  record: AttendanceRecordRow | null;
  serverTime: DateTimeString;
}

// ---------- leave types and balances ----------

export interface LeaveTypeRef {
  leaveTypeId: number;
  typeName: string;
  /** Decimal(5,2) → number. */
  defaultAnnualDays: number;
}

export interface LeaveType extends LeaveTypeRef {
  description: string | null;
  /** Derived: `defaultAnnualDays > 0`. */
  requiresBalance: boolean;
  balanceCount: number;
  requestCount: number;
}

export interface LeaveBalance {
  leaveBalanceId: number;
  employeeId: number;
  leaveTypeId: number;
  year: number;
  allocatedDays: number;
  carriedForwardDays: number;
  usedDays: number;
  updatedAt: DateTimeString;
  /** allocated + carriedForward − used. */
  remainingDays: number;
  /** Days locked up by PENDING requests. */
  pendingDays: number;
  /** remaining − pending: what a new request can still consume. */
  availableDays: number;
  leaveType: LeaveTypeRef;
  employee: EmployeeRef;
}

// ---------- time off ----------

export interface TimeOffApproval {
  approvalId: number;
  timeOffRequestId: number;
  reviewedBy: number;
  decision: ApprovalDecision;
  comments: string | null;
  decidedAt: DateTimeString;
  reviewer: Pick<EmployeeRef, "employeeId" | "firstName" | "lastName">;
}

export interface TimeOffRequest {
  timeOffRequestId: number;
  employeeId: number;
  leaveTypeId: number;
  startDate: DateString;
  endDate: DateString;
  /** Decimal(5,2) → number. */
  totalDays: number;
  reason: string | null;
  status: TimeOffStatus;
  requestedAt: DateTimeString;
  updatedAt: DateTimeString;
  employee: EmployeeRef & { department: DepartmentRef | null };
  leaveType: LeaveTypeRef;
  approval: TimeOffApproval | null;
}
