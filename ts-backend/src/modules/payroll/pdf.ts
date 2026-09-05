import PDFDocument from 'pdfkit';
import { NotFoundError } from '../../lib/errors';
import { toDateOnly } from '../../lib/dates';
import { prisma } from '../../lib/prisma';

export async function loadPayslipDocument(payslipId: number) {
  const payslip = await prisma.payslip.findUnique({
    where: { payslipId },
    include: {
      employee: { select: { employeeId: true, firstName: true, lastName: true, email: true, jobTitle: true } },
      contract: { select: { contractId: true, contractType: true } },
      payrun: { include: { salaryStructure: { select: { salaryStructureId: true, name: true } } } },
      lines: { orderBy: { sequence: 'asc' } },
    },
  });
  if (!payslip) throw new NotFoundError('Payslip', payslipId);
  return payslip;
}

function amount(currency: string, value: { toFixed(decimalPlaces: number): string }): string {
  return `${currency} ${value.toFixed(2)}`;
}

export async function createPayslipPdf(payslipId: number): Promise<Buffer> {
  const payslip = await loadPayslipDocument(payslipId);
  if (!payslip.computedAt) throw new Error('Payslip must be computed before a PDF can be generated');

  const document = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `Payslip ${payslip.payrun.name} — ${payslip.employee.firstName} ${payslip.employee.lastName}`,
      Author: 'PeoplePay360',
      Subject: `Payroll period ${toDateOnly(payslip.payrun.periodStart)} to ${toDateOnly(payslip.payrun.periodEnd)}`,
    },
  });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  const employeeName = `${payslip.employee.firstName} ${payslip.employee.lastName}`;
  document.fontSize(22).font('Helvetica-Bold').text('PeoplePay360 Payslip', { align: 'center' });
  document.moveDown(0.4).fontSize(11).font('Helvetica').fillColor('#555555').text(payslip.payrun.name, { align: 'center' });
  document.moveDown(1.2).fillColor('#111111');

  const label = (name: string, value: string) => {
    document.font('Helvetica-Bold').text(`${name}: `, { continued: true }).font('Helvetica').text(value);
  };
  label('Employee', employeeName);
  label('Email', payslip.employee.email);
  label('Job title', payslip.employee.jobTitle ?? '—');
  label('Contract', `${payslip.contract.contractType} (#${payslip.contractId})`);
  label('Salary structure', payslip.payrun.salaryStructure.name);
  label('Period', `${toDateOnly(payslip.payrun.periodStart)} to ${toDateOnly(payslip.payrun.periodEnd)}`);
  label('Currency', payslip.currency);
  document.moveDown(0.8);
  document
    .fontSize(10)
    .fillColor('#444444')
    .text(
      `Expected ${payslip.expectedDays.toFixed(2)} days / ${payslip.expectedHours.toFixed(2)} hours   •   ` +
        `Worked ${payslip.workedDays.toFixed(2)} days / ${payslip.workedHours.toFixed(2)} hours   •   ` +
        `Unpaid ${payslip.unpaidDays.toFixed(2)} days`,
    );

  document.moveDown(1.2).fillColor('#111111').fontSize(13).font('Helvetica-Bold').text('Salary Computation');
  document.moveDown(0.4);
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  const rowHeight = 22;
  const header = () => {
    const y = document.y;
    document.rect(left, y, right - left, rowHeight).fill('#1f2937');
    document.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    document.text('Rule', left + 6, y + 7, { width: 250 });
    document.text('Category', left + 260, y + 7, { width: 100 });
    document.text('Amount', right - 120, y + 7, { width: 114, align: 'right' });
    document.y = y + rowHeight;
  };
  header();
  for (const line of payslip.lines) {
    if (document.y + rowHeight > document.page.height - document.page.margins.bottom - 80) {
      document.addPage();
      header();
    }
    const y = document.y;
    if (line.sequence % 20 === 0) document.rect(left, y, right - left, rowHeight).fill('#f3f4f6');
    document.fillColor('#111111').fontSize(9).font('Helvetica');
    document.text(`${line.ruleName} (${line.ruleCode})`, left + 6, y + 7, { width: 250 });
    document.text(line.category, left + 260, y + 7, { width: 100 });
    document.text(amount(payslip.currency, line.amount), right - 120, y + 7, { width: 114, align: 'right' });
    document.y = y + rowHeight;
  }

  document.moveDown(0.7);
  const total = (name: string, value: { toFixed(decimalPlaces: number): string }, bold = false) => {
    document.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10);
    document.text(`${name}: ${amount(payslip.currency, value)}`, { align: 'right' });
  };
  total('Basic', payslip.basic);
  total('Allowances', payslip.allowances);
  total('Gross', payslip.gross);
  total('Deductions', payslip.deductions);
  total('Net Pay', payslip.net, true);

  document.moveDown(2).font('Helvetica').fontSize(8).fillColor('#666666').text('Generated by PeoplePay360. This document reflects the payroll snapshots stored for this payrun.', { align: 'center' });
  document.end();
  return finished;
}
