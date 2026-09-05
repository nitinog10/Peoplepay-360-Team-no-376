/**
 * One entry point for data access: `api.employees.list(…)` for reads (pass the
 * result to `useQuery`), `api.departments.create(…)` for writes.
 *
 * `http` and `ApiError` come from `./client` when a screen needs the wrapper
 * directly; nothing outside `lib/api` should call `fetch`.
 */

import { attendance } from "./attendance";
import { auth } from "./client";
import { contracts } from "./contracts";
import { departments } from "./departments";
import { employees } from "./employees";
import { leaveBalances } from "./leave-balances";
import { leaveTypes } from "./leave-types";
import { timeOff } from "./time-off";
import { users } from "./users";
import { workSchedules } from "./work-schedules";

export const api = {
  attendance,
  auth,
  contracts,
  departments,
  employees,
  leaveBalances,
  leaveTypes,
  timeOff,
  users,
  workSchedules,
};

export { ApiError, hasAccessToken, http, onSessionEnded, refreshSession } from "./client";

/** The query keys, for `invalidateQueries` after a write. */
export { attendanceKeys } from "./attendance";
export { contractKeys } from "./contracts";
export { departmentKeys } from "./departments";
export { employeeKeys } from "./employees";
export { leaveBalanceKeys } from "./leave-balances";
export { leaveTypeKeys } from "./leave-types";
export { timeOffKeys } from "./time-off";
export { roleKeys, userKeys } from "./users";
export { workScheduleKeys } from "./work-schedules";

export type { ListRecordsQuery, MarkAbsencesResult, Punch } from "./attendance";
export type { ListContractsQuery, ContractBody, UpdateContractBody } from "./contracts";
export type { ListEmployeesQuery, CreateScheduleAssignmentBody, UpdateScheduleAssignmentBody } from "./employees";
export type { MyBalancesResponse, ListBalancesQuery, CreateBalanceBody, UpdateBalanceBody, InitializeYearBody, InitializeYearResult, RecomputeResult } from "./leave-balances";
export type { LeaveTypeBody } from "./leave-types";
export type { ListTimeOffRequestsQuery, TimeOffRequestBody, DecisionTimeOffBody } from "./time-off";
export type { ListUsersQuery, CreateUserBody, UpdateUserBody } from "./users";
export type { WorkScheduleBody } from "./work-schedules";
export * from "./types";
