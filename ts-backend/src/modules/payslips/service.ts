import { scopeToEmployee } from '../../auth/permissions';
import type { Prisma } from '../../generated/prisma/client';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { listResponse, toOrderBy, toSkipTake } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { Actor } from '../../lib/security';
import { createPayslipPdf } from '../payroll/pdf';
import { recomputePayslip } from '../payruns/service';
import type { ListPayslipsQuery } from './schema';

const employeeSelect = {
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
  jobTitle: true,
  department: { select: { departmentId: true, departmentName: true } },
} as const;

const detailInclude = {
  employee: { select: employeeSelect },
  contract: { select: { contractId: true, contractType: true, startDate: true, endDate: true } },
  payrun: {
    include: { salaryStructure: { select: { salaryStructureId: true, name: true, currency: true } } },
  },
  lines: { orderBy: { sequence: 'asc' as const } },
} as const;

type DetailRow = Prisma.PayslipGetPayload<{ include: typeof detailInclude }>;

function present(row: DetailRow) {
  const groups = {
    BASIC: row.lines.filter((line) => line.category === 'BASIC'),
    ALLOWANCE: row.lines.filter((line) => line.category === 'ALLOWANCE'),
    GROSS: row.lines.filter((line) => line.category === 'GROSS'),
    DEDUCTION: row.lines.filter((line) => line.category === 'DEDUCTION'),
    NET: row.lines.filter((line) => line.category === 'NET'),
  };
  return {
    ...row,
    status: row.payrun.status,
    periodStart: row.payrun.periodStart,
    periodEnd: row.payrun.periodEnd,
    salaryStructure: row.payrun.salaryStructure,
    groups,
    totals: {
      basic: row.basic,
      allowances: row.allowances,
      gross: row.gross,
      deductions: row.deductions,
      net: row.net,
    },
  };
}

async function find(payslipId: number) {
  const row = await prisma.payslip.findUnique({ where: { payslipId }, include: detailInclude });
  if (!row) throw new NotFoundError('Payslip', payslipId);
  return row;
}

export async function list(actor: Actor, query: ListPayslipsQuery) {
  const own = scopeToEmployee(actor, query.employeeId);
  const where: Prisma.PayslipWhereInput = {
    ...(own !== undefined ? { employeeId: own } : {}),
    ...(query.payrunId ? { payrunId: query.payrunId } : {}),
    ...(
      query.status || query.from || query.to
        ? {
            payrun: {
              ...(query.status ? { status: query.status } : {}),
              ...(query.from ? { periodEnd: { gte: query.from } } : {}),
              ...(query.to ? { periodStart: { lte: query.to } } : {}),
            },
          }
        : {}
    ),
    ...(query.q
      ? {
          OR: [
            { employee: { firstName: { contains: query.q } } },
            { employee: { lastName: { contains: query.q } } },
            { employee: { email: { contains: query.q } } },
            { payrun: { name: { contains: query.q } } },
            { payrun: { salaryStructure: { name: { contains: query.q } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      include: {
        employee: { select: employeeSelect },
        payrun: {
          include: { salaryStructure: { select: { salaryStructureId: true, name: true, currency: true } } },
        },
      },
      ...toSkipTake(query),
      orderBy: toOrderBy(
        query,
        ['payslipId', 'employeeId', 'payrunId', 'workedDays', 'gross', 'net', 'computedAt', 'createdAt'] as const,
        'payslipId',
      ),
    }),
    prisma.payslip.count({ where }),
  ]);
  return listResponse(
    rows.map((row) => ({
      ...row,
      status: row.payrun.status,
      periodStart: row.payrun.periodStart,
      periodEnd: row.payrun.periodEnd,
      salaryStructure: row.payrun.salaryStructure,
    })),
    total,
    query,
  );
}

export async function get(actor: Actor, payslipId: number) {
  const row = await find(payslipId);
  scopeToEmployee(actor, row.employeeId);
  return present(row);
}

export async function recompute(actor: Actor, payslipId: number) {
  const row = await find(payslipId);
  scopeToEmployee(actor, row.employeeId);
  await recomputePayslip(payslipId);
  return get(actor, payslipId);
}

export async function pdf(actor: Actor, payslipId: number) {
  const row = await find(payslipId);
  scopeToEmployee(actor, row.employeeId);
  if (!row.computedAt) throw new BusinessRuleError('Payslip must be computed before a PDF can be generated');
  const buffer = await createPayslipPdf(payslipId);
  const safeName = `${row.employee.firstName}-${row.employee.lastName}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  return { buffer, filename: `payslip-${safeName}-${payslipId}.pdf` };
}

export async function remove(payslipId: number) {
  const slip = await prisma.payslip.findUnique({
    where: { payslipId },
    select: { payrun: { select: { status: true } } },
  });
  if (!slip) throw new NotFoundError('Payslip', payslipId);
  if (slip.payrun.status !== 'DRAFT') {
    throw new BusinessRuleError(`Only payslips in a DRAFT payrun can be deleted (current: ${slip.payrun.status})`, {
      status: slip.payrun.status,
    });
  }
  await prisma.payslip.delete({ where: { payslipId } });
}
