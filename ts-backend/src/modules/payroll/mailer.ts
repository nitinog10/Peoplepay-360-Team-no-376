import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { createPayslipPdf } from './pdf';

function createTransport() {
  if (!env.SMTP_HOST) return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
  });
}

export async function sendPayrunPayslips(payrunId: number) {
  const run = await prisma.payrun.findUnique({
    where: { payrunId },
    include: {
      payslips: {
        include: { employee: { select: { employeeId: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });
  if (!run) throw new NotFoundError('Payrun', payrunId);
  if (run.status !== 'VALIDATED' && run.status !== 'PAID') {
    throw new BusinessRuleError(`Payslips can only be sent for VALIDATED or PAID payruns (current: ${run.status})`);
  }

  const transport = createTransport();
  const results: Array<{
    employeeId: number;
    payslipId: number;
    email: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }> = [];
  for (const payslip of run.payslips) {
    try {
      const pdf = await createPayslipPdf(payslip.payslipId);
      const info = await transport.sendMail({
        from: env.MAIL_FROM ?? 'PeoplePay360 Payroll <payroll@peoplepay.local>',
        to: payslip.employee.email,
        subject: `Payslip: ${run.name}`,
        text: `Hello ${payslip.employee.firstName},\n\nYour payslip for ${run.name} is attached.\n\nPeoplePay360 Payroll`,
        attachments: [{ filename: `payslip-${payslip.payslipId}.pdf`, content: pdf, contentType: 'application/pdf' }],
      });
      results.push({
        employeeId: payslip.employee.employeeId,
        payslipId: payslip.payslipId,
        email: payslip.employee.email,
        success: true,
        messageId: info.messageId,
      });
    } catch (error) {
      results.push({
        employeeId: payslip.employee.employeeId,
        payslipId: payslip.payslipId,
        email: payslip.employee.email,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  transport.close();
  return { transport: env.SMTP_HOST ? 'smtp' : 'json', results };
}
