import type { AttendanceRecord, Prisma, WorkSchedule } from '../../generated/prisma/client';
import { env } from '../../config/env';
import { roundHours, toDateOnly } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import { ScheduleCache } from '../attendance/service';
import { derive } from '../attendance/derive';
import type { PayrollDashboardQuery } from './schema';

type DepartmentKey = number | 'unassigned';
type DepartmentAccumulator = {
  departmentId: number | null;
  departmentName: string;
  employees: Set<number>;
  salaryCost: number;
  netPaid: number;
  payslips: number;
  present: number;
  absent: number;
  healthy: number;
  approvedTimeOffDays: number;
};

type Alert = {
  type: 'MISSING_BANK_DETAILS' | 'DUPLICATE_PAYSLIP' | 'PAYRUN_NOT_VALIDATED' | 'CONTRACT_EXPIRING';
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  href: string;
};

const money = (value: Prisma.Decimal | number) => Number(value);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const health = (healthy: number, present: number, absent: number) => {
  const total = present + absent;
  return total === 0 ? 100 : Math.round((Math.max(0, healthy) / total) * 10_000) / 100;
};

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function departmentKey(employee: { departmentId: number | null }): DepartmentKey {
  return employee.departmentId ?? 'unassigned';
}

function getDepartment(
  map: Map<DepartmentKey, DepartmentAccumulator>,
  employee: { employeeId: number; departmentId: number | null; department: { departmentName: string } | null },
) {
  const key = departmentKey(employee);
  let row = map.get(key);
  if (!row) {
    row = {
      departmentId: employee.departmentId,
      departmentName: employee.department?.departmentName ?? 'Unassigned',
      employees: new Set<number>(),
      salaryCost: 0,
      netPaid: 0,
      payslips: 0,
      present: 0,
      absent: 0,
      healthy: 0,
      approvedTimeOffDays: 0,
    };
    map.set(key, row);
  }
  row.employees.add(employee.employeeId);
  return row;
}

export async function payrollDashboard(query: PayrollDashboardQuery) {
  const employeeWhere: Prisma.EmployeeWhereInput = {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.contractType
      ? {
          contracts: {
            some: {
              contractType: query.contractType,
              startDate: { lte: query.to },
              OR: [{ endDate: null }, { endDate: { gte: query.from } }],
            },
          },
        }
      : {}),
  };

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: {
      employeeId: true,
      firstName: true,
      lastName: true,
      status: true,
      departmentId: true,
      department: { select: { departmentName: true } },
      bankDetail: { select: { employeeBankDetailId: true } },
    },
  });
  const employeeIds = employees.map((employee) => employee.employeeId);
  const emptyIds = employeeIds.length === 0 ? [-1] : employeeIds;
  const employeeById = new Map(employees.map((employee) => [employee.employeeId, employee]));
  const payrunPeriod = { periodStart: { lte: query.to }, periodEnd: { gte: query.from } };

  const [payslips, attendanceRecords, requests, openRuns, expiringContracts] = await Promise.all([
    prisma.payslip.findMany({
      where: {
        employeeId: { in: emptyIds },
        computedAt: { not: null },
        ...(query.contractType ? { contract: { contractType: query.contractType } } : {}),
        payrun: { status: { not: 'CANCELLED' }, ...payrunPeriod },
      },
      select: {
        payslipId: true,
        employeeId: true,
        net: true,
        payrun: { select: { payrunId: true, name: true, status: true, periodStart: true, periodEnd: true, currency: true } },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { employeeId: { in: emptyIds }, attendanceDate: { gte: query.from, lte: query.to } },
      include: { entries: { orderBy: { entryTime: 'asc' } } },
    }),
    prisma.timeOffRequest.findMany({
      where: {
        employeeId: { in: emptyIds },
        status: { in: ['APPROVED', 'PENDING'] },
        startDate: { lte: query.to },
        endDate: { gte: query.from },
      },
      select: { timeOffRequestId: true, employeeId: true, status: true, totalDays: true },
    }),
    prisma.payrun.findMany({
      where: {
        status: { in: ['DRAFT', 'COMPUTED'] },
        ...payrunPeriod,
        payslips: {
          some: {
            employeeId: { in: emptyIds },
            ...(query.contractType ? { contract: { contractType: query.contractType } } : {}),
          },
        },
      },
      select: { payrunId: true, name: true, status: true, periodEnd: true },
    }),
    prisma.contract.findMany({
      where: {
        employeeId: { in: emptyIds },
        status: 'ACTIVE',
        endDate: { gte: query.from, lte: query.to },
        ...(query.contractType ? { contractType: query.contractType } : {}),
      },
      select: { contractId: true, employeeId: true, endDate: true },
    }),
  ]);

  const departments = new Map<DepartmentKey, DepartmentAccumulator>();
  for (const employee of employees) getDepartment(departments, employee);

  let salaryCost = 0;
  let totalNetPaid = 0;
  let paidPayslips = 0;
  const generatedEmployees = new Set<number>();
  const monthly = new Map<string, number>();
  for (const slip of payslips) {
    const net = money(slip.net);
    salaryCost += net;
    generatedEmployees.add(slip.employeeId);
    monthly.set(monthKey(slip.payrun.periodEnd), (monthly.get(monthKey(slip.payrun.periodEnd)) ?? 0) + net);
    const employee = employeeById.get(slip.employeeId);
    if (employee) {
      const department = getDepartment(departments, employee);
      department.salaryCost += net;
      department.payslips += 1;
      if (slip.payrun.status === 'PAID') department.netPaid += net;
    }
    if (slip.payrun.status === 'PAID') {
      totalNetPaid += net;
      paidPayslips += 1;
    }
  }

  const scheduleCache = new ScheduleCache();
  let present = 0;
  let absent = 0;
  let late = 0;
  let overtimeHours = 0;
  let missingCheckouts = 0;
  let manualEdits = 0;
  for (const record of attendanceRecords) {
    const schedule = await scheduleCache.for(record.employeeId, record.attendanceDate);
    const derived = derive(record.entries, record.attendanceDate, schedule as WorkSchedule | null);
    const isPresent = record.status === 'PRESENT' || record.status === 'HALF_DAY';
    const isAbsent = record.status === 'ABSENT';
    if (isPresent) present += 1;
    if (isAbsent) absent += 1;
    if (derived.isLate) late += 1;
    overtimeHours += derived.overtimeHours;
    if (derived.missingCheckout) missingCheckouts += 1;
    manualEdits += record.entries.filter((entry) => entry.source === 'MANUAL').length;
    const employee = employeeById.get(record.employeeId);
    if (employee) {
      const department = getDepartment(departments, employee);
      if (isPresent) department.present += 1;
      if (isAbsent) department.absent += 1;
      if (isPresent && !derived.isLate && !derived.missingCheckout) department.healthy += 1;
    }
  }

  let approvedTimeOffDays = 0;
  let pendingTimeOffDays = 0;
  let approvedRequests = 0;
  let pendingRequests = 0;
  for (const request of requests) {
    const days = money(request.totalDays);
    if (request.status === 'APPROVED') {
      approvedTimeOffDays += days;
      approvedRequests += 1;
      const employee = employeeById.get(request.employeeId);
      if (employee) getDepartment(departments, employee).approvedTimeOffDays += days;
    } else {
      pendingTimeOffDays += days;
      pendingRequests += 1;
    }
  }

  const alerts: Alert[] = [];
  for (const employee of employees) {
    if (employee.status === 'ACTIVE' && !employee.bankDetail) {
      alerts.push({
        type: 'MISSING_BANK_DETAILS',
        severity: 'WARNING',
        title: 'Missing bank details',
        message: `${employee.firstName} ${employee.lastName} has no bank account on file.`,
        href: `/employees/${employee.employeeId}`,
      });
    }
  }

  const duplicatePairs = new Set<string>();
  for (let left = 0; left < payslips.length; left += 1) {
    for (let right = left + 1; right < payslips.length; right += 1) {
      const a = payslips[left];
      const b = payslips[right];
      if (a.employeeId !== b.employeeId || a.payrun.payrunId === b.payrun.payrunId) continue;
      if (a.payrun.periodStart > b.payrun.periodEnd || a.payrun.periodEnd < b.payrun.periodStart) continue;
      const key = [a.payslipId, b.payslipId].sort((x, y) => x - y).join(':');
      if (duplicatePairs.has(key)) continue;
      duplicatePairs.add(key);
      const employee = employeeById.get(a.employeeId);
      alerts.push({
        type: 'DUPLICATE_PAYSLIP',
        severity: 'CRITICAL',
        title: 'Overlapping payslips',
        message: `${employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${a.employeeId}`} has overlapping payroll periods.`,
        href: `/payroll/payslips?employeeId=${a.employeeId}`,
      });
    }
  }
  for (const run of openRuns) {
    alerts.push({
      type: 'PAYRUN_NOT_VALIDATED',
      severity: run.periodEnd < new Date() ? 'CRITICAL' : 'WARNING',
      title: 'Payrun not validated',
      message: `${run.name} is still ${run.status.toLowerCase()}.`,
      href: `/payroll/payruns/${run.payrunId}`,
    });
  }
  for (const contract of expiringContracts) {
    const employee = employeeById.get(contract.employeeId);
    alerts.push({
      type: 'CONTRACT_EXPIRING',
      severity: 'WARNING',
      title: 'Contract expiring',
      message: `${employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${contract.employeeId}`} ends on ${toDateOnly(contract.endDate!)}.`,
      href: `/contracts/${contract.contractId}`,
    });
  }

  const generated = payslips.length;
  const attendanceHealthPercent = health(present - late - missingCheckouts, present, absent);
  const departmentBreakdown = [...departments.values()]
    .map((row) => ({
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      employees: row.employees.size,
      salaryCost: roundMoney(row.salaryCost),
      netPaid: roundMoney(row.netPaid),
      payslips: row.payslips,
      attendanceHealthPercent: health(row.healthy, row.present, row.absent),
      approvedTimeOffDays: roundMoney(row.approvedTimeOffDays),
    }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));

  return {
    filters: {
      from: toDateOnly(query.from),
      to: toDateOnly(query.to),
      departmentId: query.departmentId ?? null,
      contractType: query.contractType ?? null,
    },
    currency: env.DEFAULT_CURRENCY,
    kpis: {
      totalNetPaid: roundMoney(totalNetPaid),
      payslipsGenerated: { total: generated, paid: paidPayslips, pending: generated - paidPayslips },
      averageSalaryPerEmployee: generatedEmployees.size === 0 ? 0 : roundMoney(salaryCost / generatedEmployees.size),
      approvedTimeOffDays: roundMoney(approvedTimeOffDays),
      attendanceHealthPercent,
    },
    salaryCostByDepartment: departmentBreakdown
      .filter((row) => row.salaryCost > 0)
      .map((row) => ({ departmentId: row.departmentId, departmentName: row.departmentName, amount: row.salaryCost })),
    monthlyNetTrend: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount: roundMoney(amount) })),
    alerts,
    attendance: {
      records: attendanceRecords.length,
      present,
      late,
      absent,
      overtimeHours: roundHours(overtimeHours),
      missingCheckouts,
      manualEdits,
      healthPercent: attendanceHealthPercent,
    },
    timeOff: {
      approvedDays: roundMoney(approvedTimeOffDays),
      pendingDays: roundMoney(pendingTimeOffDays),
      approvedRequests,
      pendingRequests,
    },
    departmentBreakdown,
  };
}
