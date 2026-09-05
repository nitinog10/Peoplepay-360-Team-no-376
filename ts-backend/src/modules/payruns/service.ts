import { Prisma } from '../../generated/prisma/client';
import type { PayrunStatus } from '../../generated/prisma/enums';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { Actor } from '../../lib/security';
import { getActiveContract } from '../contracts/service';
import { executePayroll, PayrollEngineError } from '../payroll/engine';
import { derivePayrollInputs, type PayrollWarning } from '../payroll/inputs';
import type {
  CancelPayrunInput,
  CreatePayrunInput,
  EligibleEmployeesQuery,
  ListPayrunsQuery,
} from './schema';

const actorSelect = { employeeId: true, firstName: true, lastName: true, email: true } as const;
const employeeSelect = {
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
  jobTitle: true,
  department: { select: { departmentId: true, departmentName: true } },
} as const;

const detailInclude = {
  salaryStructure: true,
  creator: { select: actorSelect },
  validator: { select: actorSelect },
  payer: { select: actorSelect },
  canceller: { select: actorSelect },
  payslips: {
    include: { employee: { select: employeeSelect } },
    orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
  },
} satisfies Prisma.PayrunInclude;

function sumMoney(values: readonly Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
}

function presentDetail<T extends { payslips: Array<{ gross: Prisma.Decimal; deductions: Prisma.Decimal; net: Prisma.Decimal }> }>(run: T) {
  return {
    ...run,
    payslipCount: run.payslips.length,
    totals: {
      gross: sumMoney(run.payslips.map((payslip) => payslip.gross)),
      deductions: sumMoney(run.payslips.map((payslip) => payslip.deductions)),
      net: sumMoney(run.payslips.map((payslip) => payslip.net)),
    },
  };
}

async function findPayrun(payrunId: number) {
  const run = await prisma.payrun.findUnique({ where: { payrunId }, include: detailInclude });
  if (!run) throw new NotFoundError('Payrun', payrunId);
  return run;
}

export async function list(query: ListPayrunsQuery) {
  const where: Prisma.PayrunWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.structureId ? { salaryStructureId: query.structureId } : {}),
    ...(query.from ? { periodEnd: { gte: query.from } } : {}),
    ...(query.to ? { periodStart: { lte: query.to } } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q } },
            { salaryStructure: { name: { contains: query.q } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.payrun.findMany({
      where,
      include: {
        salaryStructure: { select: { salaryStructureId: true, name: true, currency: true } },
        payslips: { select: { gross: true, deductions: true, net: true } },
      },
      ...toSkipTake(query),
      orderBy: toOrderBy(
        query,
        ['payrunId', 'name', 'periodStart', 'periodEnd', 'status', 'createdAt', 'updatedAt'] as const,
        'periodStart',
      ),
    }),
    prisma.payrun.count({ where }),
  ]);
  return listResponse(rows.map(presentDetail), total, query);
}

export async function get(payrunId: number) {
  return presentDetail(await findPayrun(payrunId));
}

async function structureForSelection(structureId: number) {
  const structure = await prisma.salaryStructure.findUnique({ where: { salaryStructureId: structureId } });
  if (!structure) throw new NotFoundError('Salary structure', structureId);
  if (!structure.isActive) throw new BusinessRuleError('Inactive salary structures cannot be used for a new payrun');
  return structure;
}

export async function eligibleEmployees(query: EligibleEmployeesQuery) {
  const structure = await structureForSelection(query.structureId);
  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q } },
              { lastName: { contains: query.q } },
              { email: { contains: query.q } },
              { jobTitle: { contains: query.q } },
            ],
          }
        : {}),
    },
    select: employeeSelect,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const contracts = await Promise.all(
    employees.map(async (employee) => ({ employeeId: employee.employeeId, contract: await getActiveContract(employee.employeeId, query.to) })),
  );
  const contractByEmployee = new Map(contracts.map((row) => [row.employeeId, row.contract]));
  const includedEmployees = employees.filter((employee) => {
    const contract = contractByEmployee.get(employee.employeeId);
    return !query.contractType || contract === null || contract?.contractType === query.contractType;
  });
  const duplicates = await prisma.payslip.findMany({
    where: {
      employeeId: { in: includedEmployees.map((employee) => employee.employeeId) },
      payrun: {
        status: { not: 'CANCELLED' },
        periodStart: { lte: query.to },
        periodEnd: { gte: query.from },
      },
    },
    select: {
      employeeId: true,
      payslipId: true,
      payrun: { select: { payrunId: true, name: true, status: true, periodStart: true, periodEnd: true } },
    },
  });
  const duplicateByEmployee = new Map(duplicates.map((row) => [row.employeeId, row]));

  const data = includedEmployees.map((employee) => {
    const contract = contractByEmployee.get(employee.employeeId) ?? null;
    const duplicate = duplicateByEmployee.get(employee.employeeId);
    const flags: Array<{ code: string; message: string }> = [];
    if (!contract) flags.push({ code: 'NO_ACTIVE_CONTRACT', message: 'No active contract at the pay period end' });
    if (contract && (!contract.baseSalary || !contract.baseSalary.greaterThan(0))) {
      flags.push({ code: 'MISSING_BASE_SALARY', message: 'The active contract has no positive base salary' });
    }
    if (contract && contract.currency?.toUpperCase() !== structure.currency.toUpperCase()) {
      flags.push({ code: 'CURRENCY_MISMATCH', message: 'Contract and salary structure currencies do not match' });
    }
    if (duplicate) flags.push({ code: 'DUPLICATE_PAYSLIP', message: 'An overlapping non-cancelled payslip already exists' });
    return {
      ...employee,
      contract: contract
        ? {
            contractId: contract.contractId,
            contractType: contract.contractType,
            startDate: contract.startDate,
            endDate: contract.endDate,
            baseSalary: contract.baseSalary,
            currency: contract.currency,
          }
        : null,
      duplicate: duplicate ?? null,
      flags,
      selectable: flags.length === 0,
    };
  });

  return { structure, period: { from: query.from, to: query.to }, data };
}

export async function create(actor: Actor, input: CreatePayrunInput) {
  const eligibility = await eligibleEmployees({
    structureId: input.structureId,
    from: input.periodStart,
    to: input.periodEnd,
  });
  const byId = new Map(eligibility.data.map((row) => [row.employeeId, row]));
  const rejected = input.employeeIds.flatMap((employeeId) => {
    const row = byId.get(employeeId);
    return !row || !row.selectable ? [{ employeeId, flags: row?.flags ?? [{ code: 'NOT_ACTIVE', message: 'Employee is not active' }] }] : [];
  });
  if (rejected.length > 0) throw new BusinessRuleError('One or more selected employees are not eligible', { employees: rejected });

  const run = await prisma.$transaction(async (tx) =>
    tx.payrun.create({
      data: {
        name: input.name,
        salaryStructureId: input.structureId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        currency: eligibility.structure.currency,
        createdBy: actor.employeeId,
        payslips: {
          create: input.employeeIds.map((employeeId) => {
            const row = byId.get(employeeId)!;
            return {
              employeeId,
              contractId: row.contract!.contractId,
              contractWage: row.contract!.baseSalary!,
              currency: row.contract!.currency!,
            };
          }),
        },
      },
      select: { payrunId: true },
    }),
  );
  return get(run.payrunId);
}

function assertMutable(status: PayrunStatus) {
  if (status !== 'DRAFT' && status !== 'COMPUTED') {
    throw new BusinessRuleError(`Payrun cannot be computed while ${status}`);
  }
}

async function computeSlip(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  run: {
    payrunId: number;
    periodStart: Date;
    periodEnd: Date;
    currency: string;
    salaryStructure: { rules: Array<Parameters<typeof executePayroll>[0][number]> };
  },
  slip: { payslipId: number; employeeId: number },
) {
  const contract = await getActiveContract(slip.employeeId, run.periodEnd, tx);
  if (!contract) throw new BusinessRuleError('Cannot compute without an active contract', { employeeId: slip.employeeId });
  if (!contract.baseSalary || !contract.baseSalary.greaterThan(0)) {
    throw new BusinessRuleError('Cannot compute without a positive base salary', { employeeId: slip.employeeId, contractId: contract.contractId });
  }
  if (contract.currency?.toUpperCase() !== run.currency.toUpperCase()) {
    throw new BusinessRuleError('Contract and payrun currencies do not match', { employeeId: slip.employeeId, contractCurrency: contract.currency, payrunCurrency: run.currency });
  }

  const calculatedInputs = await derivePayrollInputs(slip.employeeId, run.periodStart, run.periodEnd, contract, slip.payslipId, tx);
  let result;
  try {
    result = executePayroll(run.salaryStructure.rules, calculatedInputs.inputs);
  } catch (error) {
    throw new BusinessRuleError('Payroll rule computation failed', {
      employeeId: slip.employeeId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  await tx.payslipLine.deleteMany({ where: { payslipId: slip.payslipId } });
  await tx.payslipLine.createMany({
    data: result.lines.map((line) => ({
      payslipId: slip.payslipId,
      salaryRuleId: line.salaryRuleId,
      ruleName: line.ruleName,
      ruleCode: line.ruleCode,
      category: line.category,
      sequence: line.sequence,
      method: line.method,
      fixedAmount: line.fixedAmount,
      percentage: line.percentage,
      percentageBase: line.percentageBase,
      formula: line.formula,
      amount: line.amount,
    })),
  });
  await tx.payslip.update({
    where: { payslipId: slip.payslipId },
    data: {
      contractId: contract.contractId,
      contractWage: contract.baseSalary,
      currency: contract.currency!,
      expectedDays: new Prisma.Decimal(calculatedInputs.inputs.expectedDays),
      workedDays: new Prisma.Decimal(calculatedInputs.inputs.workedDays),
      unpaidDays: new Prisma.Decimal(calculatedInputs.inputs.unpaidDays),
      expectedHours: new Prisma.Decimal(calculatedInputs.inputs.expectedHours),
      workedHours: new Prisma.Decimal(calculatedInputs.inputs.workedHours),
      basic: result.basic,
      allowances: result.allowances,
      gross: result.gross,
      deductions: result.deductions,
      net: result.net,
      computedAt: new Date(),
    },
  });
}

export async function compute(payrunId: number) {
  await prisma.$transaction(
    async (tx) => {
      const run = await tx.payrun.findUnique({
        where: { payrunId },
        include: {
          salaryStructure: { include: { rules: { where: { isActive: true }, orderBy: { sequence: 'asc' } } } },
          payslips: { select: { payslipId: true, employeeId: true } },
        },
      });
      if (!run) throw new NotFoundError('Payrun', payrunId);
      assertMutable(run.status);
      if (run.salaryStructure.rules.length === 0) throw new BusinessRuleError('Salary structure has no active rules');
      if (run.payslips.length === 0) throw new BusinessRuleError('Payrun has no payslips');
      for (const slip of run.payslips) await computeSlip(tx, run, slip);
      await tx.payrun.update({ where: { payrunId }, data: { status: 'COMPUTED', computedAt: new Date() } });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
  return get(payrunId);
}

export async function recomputePayslip(payslipId: number) {
  const payrunId = await prisma.$transaction(
    async (tx) => {
      const slip = await tx.payslip.findUnique({
        where: { payslipId },
        include: {
          payrun: {
            include: { salaryStructure: { include: { rules: { where: { isActive: true }, orderBy: { sequence: 'asc' } } } } },
          },
        },
      });
      if (!slip) throw new NotFoundError('Payslip', payslipId);
      assertMutable(slip.payrun.status);
      if (slip.payrun.salaryStructure.rules.length === 0) throw new BusinessRuleError('Salary structure has no active rules');
      await computeSlip(tx, slip.payrun, slip);
      const uncomputed = await tx.payslip.count({ where: { payrunId: slip.payrunId, computedAt: null } });
      if (uncomputed === 0) {
        await tx.payrun.update({ where: { payrunId: slip.payrunId }, data: { status: 'COMPUTED', computedAt: new Date() } });
      }
      return slip.payrunId;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
  return { payrunId, payslipId };
}

export async function warnings(payrunId: number) {
  const run = await prisma.payrun.findUnique({
    where: { payrunId },
    include: {
      salaryStructure: { include: { rules: { where: { isActive: true }, orderBy: { sequence: 'asc' } } } },
      payslips: { include: { employee: { include: { bankDetail: true } } } },
    },
  });
  if (!run) throw new NotFoundError('Payrun', payrunId);
  const all: PayrollWarning[] = [];

  for (const slip of run.payslips) {
    const common = { employeeId: slip.employeeId, payslipId: slip.payslipId };
    const contract = await getActiveContract(slip.employeeId, run.periodEnd);
    if (!contract) {
      all.push({ ...common, code: 'MISSING_CONTRACT', severity: 'HARD', message: 'No active contract exists at the pay period end' });
    } else {
      if (!contract.baseSalary || !contract.baseSalary.greaterThan(0)) {
        all.push({ ...common, code: 'MISSING_BASE_SALARY', severity: 'HARD', message: 'The active contract has no positive base salary' });
      }
      if (contract.currency?.toUpperCase() !== run.currency.toUpperCase()) {
        all.push({ ...common, code: 'CURRENCY_MISMATCH', severity: 'HARD', message: 'Contract and payrun currencies do not match' });
      }
      const calculatedInputs = await derivePayrollInputs(slip.employeeId, run.periodStart, run.periodEnd, contract, slip.payslipId);
      all.push(...calculatedInputs.warnings);
      if (contract.baseSalary?.greaterThan(0) && contract.currency?.toUpperCase() === run.currency.toUpperCase()) {
        try {
          executePayroll(run.salaryStructure.rules, calculatedInputs.inputs);
        } catch (error) {
          all.push({
            ...common,
            code: 'RULE_COMPUTE_ERROR',
            severity: 'HARD',
            message: error instanceof PayrollEngineError ? error.message : 'Payroll rule computation failed',
          });
        }
      }
    }

    if (!slip.employee.bankDetail) {
      all.push({ ...common, code: 'MISSING_BANK_DETAILS', severity: 'SOFT', message: 'Employee has no bank details' });
    }
    const duplicate = await prisma.payslip.findFirst({
      where: {
        employeeId: slip.employeeId,
        payslipId: { not: slip.payslipId },
        payrun: {
          payrunId: { not: run.payrunId },
          status: { not: 'CANCELLED' },
          periodStart: { lte: run.periodEnd },
          periodEnd: { gte: run.periodStart },
        },
      },
      select: { payslipId: true, payrunId: true },
    });
    if (duplicate) {
      all.push({ ...common, code: 'DUPLICATE_PAYSLIP', severity: 'HARD', message: 'An overlapping non-cancelled payslip exists', details: duplicate });
    }
    if (!slip.computedAt) {
      all.push({ ...common, code: 'NOT_COMPUTED', severity: 'HARD', message: 'Payslip has not been computed' });
    } else if (!slip.net.greaterThan(0)) {
      all.push({ ...common, code: 'NON_POSITIVE_NET', severity: 'HARD', message: 'Computed net pay must be positive', details: { net: slip.net } });
    }
  }

  const hard = all.filter((warning) => warning.severity === 'HARD');
  const soft = all.filter((warning) => warning.severity === 'SOFT');
  return { hard, soft, counts: { hard: hard.length, soft: soft.length, total: all.length } };
}

async function transition(payrunId: number, expected: PayrunStatus, data: Prisma.PayrunUncheckedUpdateInput) {
  await prisma.$transaction(async (tx) => {
    const run = await tx.payrun.findUnique({ where: { payrunId }, select: { status: true } });
    if (!run) throw new NotFoundError('Payrun', payrunId);
    if (run.status !== expected) {
      throw new BusinessRuleError(`Payrun must be ${expected} for this action (current: ${run.status})`);
    }
    await tx.payrun.update({ where: { payrunId }, data });
  });
  return get(payrunId);
}

export async function validate(actor: Actor, payrunId: number) {
  const run = await prisma.payrun.findUnique({ where: { payrunId }, select: { status: true } });
  if (!run) throw new NotFoundError('Payrun', payrunId);
  if (run.status !== 'COMPUTED') throw new BusinessRuleError(`Only COMPUTED payruns can be validated (current: ${run.status})`);
  const currentWarnings = await warnings(payrunId);
  if (currentWarnings.hard.length > 0) {
    throw new BusinessRuleError('Payrun has hard warnings and cannot be validated', currentWarnings);
  }
  return transition(payrunId, 'COMPUTED', { status: 'VALIDATED', validatedBy: actor.employeeId, validatedAt: new Date() });
}

export async function markPaid(actor: Actor, payrunId: number) {
  return transition(payrunId, 'VALIDATED', { status: 'PAID', paidBy: actor.employeeId, paidAt: new Date() });
}

export async function cancel(actor: Actor, payrunId: number, input: CancelPayrunInput) {
  const result = await prisma.payrun.updateMany({
    where: { payrunId, status: { in: ['COMPUTED', 'VALIDATED'] } },
    data: {
      status: 'CANCELLED',
      cancelledBy: actor.employeeId,
      cancelledAt: new Date(),
      cancelReason: input.reason,
    },
  });
  if (result.count === 0) {
    const run = await prisma.payrun.findUnique({ where: { payrunId }, select: { status: true } });
    if (!run) throw new NotFoundError('Payrun', payrunId);
    throw new BusinessRuleError(`Payrun cannot be cancelled while ${run.status}`);
  }
  return get(payrunId);
}

export async function remove(payrunId: number) {
  const result = await prisma.payrun.deleteMany({ where: { payrunId, status: 'DRAFT' } });
  if (result.count > 0) return;
  const run = await prisma.payrun.findUnique({ where: { payrunId }, select: { status: true } });
  if (!run) throw new NotFoundError('Payrun', payrunId);
  throw new BusinessRuleError(`Only DRAFT payruns can be deleted (current: ${run.status})`, {
    status: run.status,
    suggestedAction: run.status === 'COMPUTED' || run.status === 'VALIDATED' ? 'cancel' : 'none',
  });
}
