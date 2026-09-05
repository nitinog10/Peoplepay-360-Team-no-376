/**
 * Representative dataset for demos and local development.
 *   npx prisma db seed        (or: npx tsx prisma/seed.ts)
 *
 * Lookup data (roles, departments, leave types, schedules) is upserted and safe to
 * re-run. Transactional data (employees, contracts, attendance, requests) is only
 * created when the database has no employees yet.
 */
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { addDays, isoWeekday, parseTime, todayLocal } from '../src/lib/dates';
import { hashPassword } from '../src/lib/security';
import { weeklyHours } from '../src/modules/work-schedules/resolve';

const log = (msg: string) => console.log(`[seed] ${msg}`);

async function seedLookups() {
  for (const roleName of ['EMPLOYEE', 'HR_MANAGER'] as const) {
    await prisma.role.upsert({ where: { roleName }, update: {}, create: { roleName } });
  }

  const departments = [
    { departmentName: 'Human Resources', description: 'People operations, hiring and policy' },
    { departmentName: 'Engineering', description: 'Product development' },
    { departmentName: 'Finance', description: 'Accounting, payroll and reporting' },
    { departmentName: 'Sales', description: 'Revenue and customer accounts' },
  ];
  for (const d of departments) {
    await prisma.department.upsert({ where: { departmentName: d.departmentName }, update: { description: d.description }, create: d });
  }

  const leaveTypes = [
    { typeName: 'Annual Leave', defaultAnnualDays: 20, description: 'Paid annual leave, balance-tracked' },
    { typeName: 'Sick Leave', defaultAnnualDays: 10, description: 'Paid sick leave, balance-tracked' },
    { typeName: 'Casual Leave', defaultAnnualDays: 6, description: 'Short-notice personal leave' },
    { typeName: 'Unpaid Leave', defaultAnnualDays: 0, description: 'Not balance-tracked; deducted by payroll later' },
  ];
  for (const t of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { typeName: t.typeName },
      update: { defaultAnnualDays: t.defaultAnnualDays, description: t.description },
      create: t,
    });
  }

  const schedules = [
    { scheduleName: 'Standard 9-5 Mon-Fri', daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00', description: 'Default full-time pattern' },
    { scheduleName: 'Early Shift Mon-Fri', daysOfWeek: [1, 2, 3, 4, 5], startTime: '07:00', endTime: '15:00', description: 'Early start' },
    { scheduleName: 'Part-time Mornings', daysOfWeek: [1, 2, 3], startTime: '09:00', endTime: '13:00', description: 'Three mornings a week' },
    { scheduleName: 'Weekend Support', daysOfWeek: [6, 7], startTime: '10:00', endTime: '18:00', description: 'Weekend coverage' },
  ];
  for (const s of schedules) {
    const startTime = parseTime(s.startTime);
    const endTime = parseTime(s.endTime);
    const data = { daysOfWeek: s.daysOfWeek, startTime, endTime, description: s.description, weeklyHours: weeklyHours({ daysOfWeek: s.daysOfWeek, startTime, endTime }) };
    await prisma.workSchedule.upsert({ where: { scheduleName: s.scheduleName }, update: data, create: { scheduleName: s.scheduleName, ...data } });
  }
  log('lookup data ready (roles, departments, leave types, work schedules)');
}

/** Deterministic pseudo-random in [0,1) so re-seeding a fresh DB yields the same data. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** Build an instant for `dateOnly` at local wall-clock minutes in APP_TIMEZONE. */
function atLocal(dateOnly: Date, minutesOfDay: number): Date {
  // Find the UTC offset in effect for that day in APP_TIMEZONE.
  const probe = new Date(dateOnly.getTime() + 12 * 3_600_000);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: env.APP_TIMEZONE, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(probe).map((p) => [p.type, p.value]));
  const localMinutes = Number(parts.hour) * 60 + Number(parts.minute) + (Number(parts.day) !== probe.getUTCDate() ? (Number(parts.day) > probe.getUTCDate() ? 1440 : -1440) : 0);
  const offsetMinutes = localMinutes - 12 * 60;
  return new Date(dateOnly.getTime() + (minutesOfDay - offsetMinutes) * 60_000);
}

async function seedTransactional() {
  const existing = await prisma.employee.count();
  if (existing > 0) {
    log(`skipping employees/contracts/attendance/time-off: ${existing} employee(s) already present`);
    return;
  }

  const today = todayLocal();
  const year = today.getUTCFullYear();
  const dept = Object.fromEntries((await prisma.department.findMany()).map((d) => [d.departmentName, d.departmentId]));
  const types = Object.fromEntries((await prisma.leaveType.findMany()).map((t) => [t.typeName, t]));
  const sched = Object.fromEntries((await prisma.workSchedule.findMany()).map((s) => [s.scheduleName, s.scheduleId]));
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.roleName, r.roleId]));

  const hire = (monthsAgo: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));

  // ---- employees (HR manager first so she can be everyone's creator/reviewer) ----
  const sara = await prisma.employee.create({
    data: { firstName: 'Sara', lastName: 'Khan', email: 'sara.khan@oxp.com', phone: '+91 98200 11001', hireDate: hire(30), departmentId: dept['Human Resources'], jobTitle: 'HR Manager' },
  });
  const maya = await prisma.employee.create({
    data: { firstName: 'Maya', lastName: 'Shah', email: 'maya.shah@oxp.com', phone: '+91 98200 11002', hireDate: hire(28), departmentId: dept['Engineering'], jobTitle: 'Engineering Manager' },
  });
  const vikram = await prisma.employee.create({
    data: { firstName: 'Vikram', lastName: 'Singh', email: 'vikram.singh@oxp.com', phone: '+91 98200 11003', hireDate: hire(26), departmentId: dept['Finance'], jobTitle: 'Finance Controller' },
  });
  const aarav = await prisma.employee.create({
    data: { firstName: 'Aarav', lastName: 'Mehta', email: 'aarav.mehta@oxp.com', phone: '+91 98765 43210', hireDate: hire(14), departmentId: dept['Finance'], jobTitle: 'Payroll Specialist', managerId: vikram.employeeId, dateOfBirth: new Date('1994-06-12T00:00:00Z'), address: 'Andheri West, Mumbai' },
  });
  const john = await prisma.employee.create({
    data: { firstName: 'John', lastName: 'Dsouza', email: 'john.dsouza@oxp.com', phone: '+91 98200 11005', hireDate: hire(11), departmentId: dept['Engineering'], jobTitle: 'Developer', managerId: maya.employeeId },
  });
  const neha = await prisma.employee.create({
    data: { firstName: 'Neha', lastName: 'Patel', email: 'neha.patel@oxp.com', phone: '+91 98200 11006', hireDate: hire(9), departmentId: dept['Human Resources'], jobTitle: 'Recruiter', managerId: sara.employeeId },
  });
  const priya = await prisma.employee.create({
    data: { firstName: 'Priya', lastName: 'Nair', email: 'priya.nair@oxp.com', phone: '+91 98200 11007', hireDate: hire(6), departmentId: dept['Engineering'], jobTitle: 'QA Engineer', managerId: maya.employeeId },
  });
  const rohan = await prisma.employee.create({
    data: { firstName: 'Rohan', lastName: 'Verma', email: 'rohan.verma@oxp.com', phone: '+91 98200 11008', hireDate: hire(4), departmentId: dept['Sales'], jobTitle: 'Account Executive', managerId: vikram.employeeId },
  });
  const dev = await prisma.employee.create({
    data: { firstName: 'Dev', lastName: 'Kapoor', email: 'dev.kapoor@oxp.com', hireDate: hire(20), terminationDate: hire(2), status: 'TERMINATED', departmentId: dept['Sales'], jobTitle: 'Sales Intern' },
  });
  const all = [sara, maya, vikram, aarav, john, neha, priya, rohan];
  log(`created ${all.length + 1} employees`);

  // ---- users ----
  const hrHash = await hashPassword(env.SEED_HR_PASSWORD);
  const empHash = await hashPassword(env.SEED_EMPLOYEE_PASSWORD);
  await prisma.user.create({ data: { employeeId: sara.employeeId, username: env.SEED_HR_USERNAME, passwordHash: hrHash, roleId: roles.HR_MANAGER } });
  for (const e of all.filter((e) => e.employeeId !== sara.employeeId)) {
    await prisma.user.create({ data: { employeeId: e.employeeId, username: e.email, passwordHash: empHash, roleId: roles.EMPLOYEE } });
  }
  log(`users: ${env.SEED_HR_USERNAME} (HR_MANAGER) + ${all.length - 1} employees (username = work email)`);

  // ---- contracts ----
  for (const e of all) {
    await prisma.contract.create({
      data: {
        employeeId: e.employeeId,
        contractType: e.jobTitle?.includes('Manager') || e.jobTitle?.includes('Controller') ? 'PERMANENT' : 'FIXED_TERM',
        startDate: e.hireDate,
        endDate: null,
        baseSalary: 45_000 + (e.employeeId % 5) * 12_500,
        currency: env.DEFAULT_CURRENCY,
        status: 'ACTIVE',
        createdBy: sara.employeeId,
      },
    });
  }
  // Aarav also has an expired earlier contract (history) and Dev a terminated one.
  await prisma.contract.create({
    data: { employeeId: aarav.employeeId, contractType: 'INTERNSHIP', startDate: hire(20), endDate: addDays(hire(14), -1), baseSalary: 25_000, currency: env.DEFAULT_CURRENCY, status: 'EXPIRED', createdBy: sara.employeeId },
  });
  await prisma.contract.create({
    data: { employeeId: dev.employeeId, contractType: 'INTERNSHIP', startDate: hire(20), endDate: hire(2), baseSalary: 20_000, currency: env.DEFAULT_CURRENCY, status: 'TERMINATED', createdBy: sara.employeeId },
  });
  log('contracts created (one ACTIVE each, plus EXPIRED and TERMINATED history)');

  // ---- schedule assignments ----
  for (const e of all) {
    const scheduleId = e.employeeId === priya.employeeId ? sched['Part-time Mornings'] : e.employeeId === rohan.employeeId ? sched['Early Shift Mon-Fri'] : sched['Standard 9-5 Mon-Fri'];
    await prisma.employeeScheduleAssignment.create({ data: { employeeId: e.employeeId, scheduleId, effectiveFrom: e.hireDate } });
  }
  log('schedule assignments created');

  // ---- leave balances for the current year (from leave type defaults) ----
  for (const e of all) {
    for (const t of Object.values(types)) {
      if (!t.defaultAnnualDays.greaterThan(0)) continue;
      await prisma.leaveBalance.create({ data: { employeeId: e.employeeId, leaveTypeId: t.leaveTypeId, year, allocatedDays: t.defaultAnnualDays } });
    }
  }
  log('leave balances initialised');

  // ---- attendance: last 14 calendar days ----
  const rand = rng(360);
  const schedulesById = Object.fromEntries((await prisma.workSchedule.findMany()).map((s) => [s.scheduleId, s]));
  const assignments = await prisma.employeeScheduleAssignment.findMany();
  let punches = 0;
  for (let back = 14; back >= 1; back--) {
    const date = addDays(today, -back);
    for (const e of all) {
      const a = assignments.find((x) => x.employeeId === e.employeeId);
      const s = a ? schedulesById[a.scheduleId] : undefined;
      if (!s) continue;
      const days = s.daysOfWeek as number[];
      if (!days.includes(isoWeekday(date))) {
        await prisma.attendanceRecord.create({ data: { employeeId: e.employeeId, attendanceDate: date, status: 'WEEK_OFF', notes: 'System-generated by day close' } });
        continue;
      }
      const roll = rand();
      if (roll < 0.06) {
        await prisma.attendanceRecord.create({ data: { employeeId: e.employeeId, attendanceDate: date, status: 'ABSENT', notes: 'System-generated by day close' } });
        continue;
      }
      const startMin = s.startTime.getUTCHours() * 60 + s.startTime.getUTCMinutes();
      const endMin = s.endTime.getUTCHours() * 60 + s.endTime.getUTCMinutes();
      const inMin = startMin + Math.floor(rand() * 35) - 10; // −10 … +25 minutes
      const outMin = endMin + Math.floor(rand() * 75) - 15; // −15 … +60 minutes
      const missingOut = back === 3 && e.employeeId === john.employeeId;
      const record = await prisma.attendanceRecord.create({ data: { employeeId: e.employeeId, attendanceDate: date, status: 'PRESENT' } });
      await prisma.attendanceEntry.create({ data: { attendanceRecordId: record.attendanceRecordId, entryType: 'CLOCK_IN', entryTime: atLocal(date, inMin), source: 'WEB' } });
      punches++;
      if (endMin - startMin >= 6 * 60) {
        const b = startMin + 4 * 60;
        await prisma.attendanceEntry.create({ data: { attendanceRecordId: record.attendanceRecordId, entryType: 'BREAK_START', entryTime: atLocal(date, b), source: 'WEB' } });
        await prisma.attendanceEntry.create({ data: { attendanceRecordId: record.attendanceRecordId, entryType: 'BREAK_END', entryTime: atLocal(date, b + 45), source: 'WEB' } });
        punches += 2;
      }
      if (!missingOut) {
        await prisma.attendanceEntry.create({ data: { attendanceRecordId: record.attendanceRecordId, entryType: 'CLOCK_OUT', entryTime: atLocal(date, outMin), source: 'WEB' } });
        punches++;
      }
    }
  }
  log(`attendance created for 14 days (${punches} punches, incl. one missing check-out)`);

  // ---- time off requests ----
  const annual = types['Annual Leave'];
  const sick = types['Sick Leave'];
  const casual = types['Casual Leave'];

  async function request(employeeId: number, leaveTypeId: number, start: Date, end: Date, totalDays: number, reason: string, decision?: 'APPROVED' | 'REJECTED') {
    const r = await prisma.timeOffRequest.create({
      data: { employeeId, leaveTypeId, startDate: start, endDate: end, totalDays, reason, status: decision ?? 'PENDING' },
    });
    if (decision) {
      await prisma.timeOffApproval.create({ data: { timeOffRequestId: r.timeOffRequestId, reviewedBy: sara.employeeId, decision, comments: decision === 'APPROVED' ? 'Approved' : 'Team coverage not available' } });
      if (decision === 'APPROVED') {
        await prisma.leaveBalance.updateMany({ where: { employeeId, leaveTypeId, year: yearOfDate(start) }, data: { usedDays: { increment: totalDays } } });
      }
    }
  }
  const yearOfDate = (d: Date) => d.getUTCFullYear();
  const nextMonday = (() => {
    let d = addDays(today, 1);
    while (isoWeekday(d) !== 1) d = addDays(d, 1);
    return d;
  })();
  const lastMonday = (() => {
    let d = addDays(today, -7);
    while (isoWeekday(d) !== 1) d = addDays(d, -1);
    return d;
  })();

  await request(aarav.employeeId, annual.leaveTypeId, lastMonday, addDays(lastMonday, 2), 3, 'Family vacation', 'APPROVED');
  await request(john.employeeId, sick.leaveTypeId, addDays(lastMonday, 3), addDays(lastMonday, 3), 1, 'Fever', 'APPROVED');
  await request(neha.employeeId, casual.leaveTypeId, nextMonday, nextMonday, 1, 'Personal errand');
  await request(rohan.employeeId, annual.leaveTypeId, addDays(nextMonday, 7), addDays(nextMonday, 11), 5, 'Trip to Goa');
  await request(priya.employeeId, casual.leaveTypeId, addDays(nextMonday, 1), addDays(nextMonday, 1), 1, 'House move', 'REJECTED');
  log('time off requests created (2 approved, 2 pending, 1 rejected)');
}

async function main() {
  await seedLookups();
  await seedTransactional();
  log('done');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
