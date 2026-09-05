import { Prisma } from '../../generated/prisma/client';
import type { Contract } from '../../generated/prisma/client';
import { eachDay, toDateOnly } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { derive } from '../attendance/derive';
import { dailyHours, isWorkingDay, resolveScheduleFor } from '../work-schedules/resolve';
import type { PayrollInputs } from './engine';

export type WarningSeverity = 'HARD' | 'SOFT';
export type PayrollWarningCode =
  | 'MISSING_CONTRACT'
  | 'MISSING_BASE_SALARY'
  | 'CURRENCY_MISMATCH'
  | 'MISSING_SCHEDULE'
  | 'INVALID_ATTENDANCE'
  | 'MISSING_CHECKOUT'
  | 'RULE_COMPUTE_ERROR'
  | 'DUPLICATE_PAYSLIP'
  | 'NOT_COMPUTED'
  | 'NON_POSITIVE_NET'
  | 'MISSING_BANK_DETAILS'
  | 'MISSING_ATTENDANCE'
  | 'PARTIAL_PERIOD_CONTRACT'
  | 'ZERO_WORKED_HOURS';

export interface PayrollWarning {
  code: PayrollWarningCode;
  severity: WarningSeverity;
  message: string;
  employeeId?: number;
  payslipId?: number;
  details?: unknown;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;
type ContractInput = Pick<Contract, 'contractId' | 'startDate' | 'endDate' | 'baseSalary' | 'currency'>;

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function derivePayrollInputs(
  employeeId: number,
  periodStart: Date,
  periodEnd: Date,
  contract: ContractInput,
  payslipId?: number,
  tx: Tx = prisma,
): Promise<{ inputs: PayrollInputs; warnings: PayrollWarning[] }> {
  const [records, approvedLeave] = await Promise.all([
    tx.attendanceRecord.findMany({
      where: { employeeId, attendanceDate: { gte: periodStart, lte: periodEnd } },
      include: { entries: { orderBy: { entryTime: 'asc' } } },
    }),
    tx.timeOffRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: { leaveType: true },
    }),
  ]);

  const byDate = new Map(records.map((record) => [toDateOnly(record.attendanceDate), record]));
  const missingScheduleDates: string[] = [];
  const missingAttendanceDates: string[] = [];
  const invalidAttendance: Array<{ date: string; error?: string }> = [];
  const missingCheckoutDates: string[] = [];
  let expectedDays = 0;
  let expectedHours = 0;
  let workedDays = 0;
  let workedHours = 0;
  let unpaidDays = 0;

  for (const date of eachDay(periodStart, periodEnd)) {
    const dateString = toDateOnly(date);
    const schedule = await resolveScheduleFor(employeeId, date, tx);
    if (!schedule) {
      missingScheduleDates.push(dateString);
      continue;
    }

    const working = isWorkingDay(schedule, date);
    const dayExpectedHours = working ? dailyHours(schedule) : 0;
    if (working) {
      expectedDays++;
      expectedHours += dayExpectedHours;
    }

    const leave = approvedLeave.find(
      (request) => request.startDate.getTime() <= date.getTime() && request.endDate.getTime() >= date.getTime(),
    );
    if (working && leave?.leaveType.defaultAnnualDays.equals(0)) unpaidDays++;

    const record = byDate.get(dateString);
    if (!record) {
      if (working && !leave) missingAttendanceDates.push(dateString);
      continue;
    }

    const calculated = derive(record.entries, date, schedule);
    if (!calculated.isValidSequence) invalidAttendance.push({ date: dateString, error: calculated.sequenceError });
    if (calculated.missingCheckout) missingCheckoutDates.push(dateString);
    workedHours += calculated.workedHours;
    if (working && dayExpectedHours > 0) workedDays += Math.min(1, calculated.workedHours / dayExpectedHours);
  }

  expectedHours = round(expectedHours);
  workedHours = round(workedHours);
  workedDays = round(workedDays);
  const common = { employeeId, ...(payslipId ? { payslipId } : {}) };
  const warnings: PayrollWarning[] = [];

  if (missingScheduleDates.length > 0) {
    warnings.push({
      ...common,
      code: 'MISSING_SCHEDULE',
      severity: 'HARD',
      message: 'No work schedule is assigned for part of the pay period',
      details: { dates: missingScheduleDates },
    });
  }
  if (invalidAttendance.length > 0) {
    warnings.push({
      ...common,
      code: 'INVALID_ATTENDANCE',
      severity: 'HARD',
      message: 'Attendance contains an invalid punch sequence',
      details: { records: invalidAttendance },
    });
  }
  if (missingCheckoutDates.length > 0) {
    warnings.push({
      ...common,
      code: 'MISSING_CHECKOUT',
      severity: 'HARD',
      message: 'Attendance contains an unclosed session',
      details: { dates: missingCheckoutDates },
    });
  }
  if (missingAttendanceDates.length > 0) {
    warnings.push({
      ...common,
      code: 'MISSING_ATTENDANCE',
      severity: 'SOFT',
      message: 'Scheduled workdays have no attendance record or approved leave',
      details: { dates: missingAttendanceDates },
    });
  }
  if (contract.startDate.getTime() > periodStart.getTime() || (contract.endDate && contract.endDate.getTime() < periodEnd.getTime())) {
    warnings.push({
      ...common,
      code: 'PARTIAL_PERIOD_CONTRACT',
      severity: 'SOFT',
      message: 'The active contract covers only part of the pay period',
      details: { contractId: contract.contractId, startDate: contract.startDate, endDate: contract.endDate },
    });
  }
  if (workedHours === 0) {
    warnings.push({ ...common, code: 'ZERO_WORKED_HOURS', severity: 'SOFT', message: 'Worked hours are zero for this pay period' });
  }

  return {
    inputs: {
      contractWage: contract.baseSalary ?? new Prisma.Decimal(0),
      expectedDays,
      workedDays,
      expectedHours,
      workedHours,
      unpaidDays,
    },
    warnings,
  };
}
