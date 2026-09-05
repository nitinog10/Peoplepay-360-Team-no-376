/**
 * One entry point for data access: `api.employees.list(…)` for reads (pass the
 * result to `useQuery`), `api.departments.create(…)` for writes.
 */

import { attendance } from "./attendance";
import { auth } from "./client";
import { contracts } from "./contracts";
import { departments } from "./departments";
import { dashboard } from "./dashboard";
import { employees } from "./employees";
import { leaveBalances } from "./leave-balances";
import { leaveTypes } from "./leave-types";
import { payruns } from "./payruns";
import { payslips } from "./payslips";
import { salaryRules } from "./salary-rules";
import { salaryStructures } from "./salary-structures";
import { timeOff } from "./time-off";
import { users } from "./users";
import { workSchedules } from "./work-schedules";

export const api = {
  attendance,
  auth,
  contracts,
  dashboard,
  departments,
  employees,
  leaveBalances,
  leaveTypes,
  payruns,
  payslips,
  salaryRules,
  salaryStructures,
  timeOff,
  users,
  workSchedules,
};

export { ApiError, download, hasAccessToken, http, onSessionEnded, refreshSession } from "./client";

/** The query keys, for `invalidateQueries` after a write. */
export { attendanceKeys } from "./attendance";
export { contractKeys } from "./contracts";
export { dashboardKeys } from "./dashboard";
export { departmentKeys } from "./departments";
export { employeeKeys } from "./employees";
export { leaveBalanceKeys } from "./leave-balances";
export { leaveTypeKeys } from "./leave-types";
export { payrunKeys } from "./payruns";
export { payslipKeys } from "./payslips";
export { salaryRuleKeys } from "./salary-rules";
export { salaryStructureKeys } from "./salary-structures";
export { timeOffKeys } from "./time-off";
export { roleKeys, userKeys } from "./users";
export { workScheduleKeys } from "./work-schedules";

export type { ListRecordsQuery, MarkAbsencesResult, Punch } from "./attendance";
export type { ListContractsQuery, ContractBody, UpdateContractBody } from "./contracts";
export type { PayrollDashboardQuery } from "./dashboard";
export type { ListEmployeesQuery, CreateScheduleAssignmentBody, UpdateScheduleAssignmentBody } from "./employees";
export type { MyBalancesResponse, ListBalancesQuery, CreateBalanceBody, UpdateBalanceBody, InitializeYearBody, InitializeYearResult, RecomputeResult } from "./leave-balances";
export type { LeaveTypeBody } from "./leave-types";
export type { CreatePayrunBody, EligibilityQuery, ListPayrunsQuery } from "./payruns";
export type { ListPayslipsQuery } from "./payslips";
export type { ListSalaryRulesQuery, SalaryRuleBody } from "./salary-rules";
export type { ListSalaryStructuresQuery, ReorderSalaryRulesBody, SalaryStructureBody } from "./salary-structures";
export type { ListTimeOffRequestsQuery, TimeOffRequestBody, DecisionTimeOffBody } from "./time-off";
export type { ListUsersQuery, CreateUserBody, UpdateUserBody } from "./users";
export type { WorkScheduleBody } from "./work-schedules";
export * from "./types";
