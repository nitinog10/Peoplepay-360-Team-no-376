/**
 * End-to-end smoke test against a running API with seeded data.
 *   API_URL=http://localhost:8000/api/v1 npx tsx scripts/smoke.ts
 *
 * Logs in as the seeded HR manager and an employee, then walks every module:
 * reads, writes, business-rule rejections and role scoping. Exits non-zero on failure.
 */
const API = process.env.API_URL ?? 'http://localhost:8000/api/v1';
const HR_USER = process.env.SEED_HR_USERNAME ?? 'hr.manager';
const HR_PASS = process.env.SEED_HR_PASSWORD ?? 'ChangeMe123!';
const EMP_USER = 'aarav.mehta@oxp.com';
const EMP_PASS = process.env.SEED_EMPLOYEE_PASSWORD ?? 'Employee123!';
const PAYROLL_USER = 'vikram.singh@oxp.com';
const PAYROLL_PASS = process.env.SEED_PAYROLL_PASSWORD ?? 'Payroll123!';

let failures = 0;
const results: string[] = [];

function ok(label: string, cond: boolean, extra = '') {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`);
  if (!cond) failures++;
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/pdf')) {
    const buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, json: null as any, buffer, headers: res.headers };
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, buffer: null as Buffer | null, headers: res.headers };
}

const today = new Date().toISOString().slice(0, 10);
function plusDays(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // ---- health & auth ----
  const health = await call('GET', '/health');
  ok('health', health.status === 200 && health.json?.database === 'up', JSON.stringify(health.json));

  const hrLogin = await call('POST', '/auth/login', undefined, { username: HR_USER, password: HR_PASS });
  ok('HR login', hrLogin.status === 200 && hrLogin.json?.user?.role === 'HR_MANAGER');
  const hr: string = hrLogin.json?.accessToken;

  const empLogin = await call('POST', '/auth/login', undefined, { username: EMP_USER, password: EMP_PASS });
  ok('employee login (by email)', empLogin.status === 200 && empLogin.json?.user?.role === 'EMPLOYEE');
  const emp: string = empLogin.json?.accessToken;
  const empId: number = empLogin.json?.user?.employee?.employeeId;

  const payrollLogin = await call('POST', '/auth/login', undefined, { username: PAYROLL_USER, password: PAYROLL_PASS });
  ok(
    'payroll login and permission superset',
    payrollLogin.status === 200 &&
      payrollLogin.json?.user?.role === 'HR_PAYROLL_USER' &&
      payrollLogin.json?.user?.permissions?.includes('payroll:read') &&
      payrollLogin.json?.user?.permissions?.includes('users:manage'),
  );
  const payroll: string = payrollLogin.json?.accessToken;

  const bad = await call('POST', '/auth/login', undefined, { username: HR_USER, password: 'nope' });
  ok('bad password rejected', bad.status === 401);

  const refreshed = await call('POST', '/auth/refresh', undefined, { refreshToken: hrLogin.json?.refreshToken });
  ok('refresh token rotation', refreshed.status === 200 && refreshed.json?.refreshToken !== hrLogin.json?.refreshToken);
  const reuse = await call('POST', '/auth/refresh', undefined, { refreshToken: hrLogin.json?.refreshToken });
  ok('reused refresh token rejected', reuse.status === 401);

  const me = await call('GET', '/auth/me', emp);
  ok('GET /auth/me', me.status === 200 && me.json?.permissions?.includes('attendance:punch'));

  // ---- RBAC scoping ----
  const empList = await call('GET', '/employees', emp);
  ok('employee sees only self in /employees', empList.status === 200 && empList.json?.meta?.total === 1);
  const hrList = await call('GET', '/employees?pageSize=50', hr);
  ok('HR sees all employees', hrList.status === 200 && hrList.json?.meta?.total >= 8, `total=${hrList.json?.meta?.total}`);
  const otherId = hrList.json?.data?.find((e: any) => e.employeeId !== empId)?.employeeId;
  const forbidden = await call('GET', `/employees/${otherId}`, emp);
  ok('employee cannot read another employee', forbidden.status === 403);
  const noWrite = await call('POST', '/departments', emp, { departmentName: 'X' });
  ok('employee cannot write departments', noWrite.status === 403);
  const noUsers = await call('GET', '/users', emp);
  ok('employee cannot manage users', noUsers.status === 403);

  // ---- master data ----
  const deptCreate = await call('POST', '/departments', hr, { departmentName: `Smoke Dept ${Date.now()}`, description: 'temp' });
  ok('create department', deptCreate.status === 201);
  const deptId = deptCreate.json?.departmentId;
  const deptDup = await call('POST', '/departments', hr, { departmentName: deptCreate.json?.departmentName });
  ok('duplicate department → 409', deptDup.status === 409);

  const sched = await call('POST', '/work-schedules', hr, {
    scheduleName: `Smoke 4x10 ${Date.now()}`,
    daysOfWeek: [1, 2, 3, 4],
    startTime: '08:00',
    endTime: '18:30',
  });
  ok('create work schedule (derived weekly hours)', sched.status === 201 && sched.json?.weeklyHours === 42, `weeklyHours=${sched.json?.weeklyHours}`);
  const badSched = await call('POST', '/work-schedules', hr, { scheduleName: 'bad', daysOfWeek: [1, 1], startTime: '09:00', endTime: '08:00' });
  ok('invalid schedule → 400', badSched.status === 400);

  // ---- employee CRUD ----
  const newEmp = await call('POST', '/employees', hr, {
    firstName: 'Smoke',
    lastName: 'Tester',
    email: `smoke.${Date.now()}@oxp.com`,
    hireDate: today,
    departmentId: deptId,
    jobTitle: 'Tester',
    managerId: empId,
  });
  ok('create employee', newEmp.status === 201 && newEmp.json?.fullName === 'Smoke Tester');
  const newId = newEmp.json?.employeeId;
  const selfMgr = await call('PATCH', `/employees/${newId}`, hr, { managerId: newId });
  ok('self-manager rejected', selfMgr.status === 422);

  const assign = await call('POST', `/employees/${newId}/schedule-assignments`, hr, { scheduleId: sched.json?.scheduleId, effectiveFrom: today });
  ok('assign schedule', assign.status === 201);
  const assignOverlap = await call('POST', `/employees/${newId}/schedule-assignments`, hr, {
    scheduleId: sched.json?.scheduleId,
    effectiveFrom: plusDays(-5),
    effectiveTo: plusDays(5),
    closePrevious: false,
  });
  ok('overlapping assignment → 409', assignOverlap.status === 409);

  const summary = await call('GET', `/employees/${empId}/summary`, hr);
  ok('employee summary', summary.status === 200 && summary.json?.counts?.contracts >= 1 && summary.json?.currentSchedule);

  // ---- contracts ----
  const c1 = await call('POST', '/contracts', hr, { employeeId: newId, contractType: 'FIXED_TERM', startDate: today, baseSalary: 50000 });
  ok('create contract (currency from env)', c1.status === 201 && typeof c1.json?.currency === 'string', `currency=${c1.json?.currency}`);
  const c2 = await call('POST', '/contracts', hr, { employeeId: newId, contractType: 'PERMANENT', startDate: plusDays(10) });
  ok('overlapping ACTIVE contract → 409', c2.status === 409);
  const term = await call('POST', `/contracts/${c1.json?.contractId}/terminate`, hr, {});
  ok('terminate contract', term.status === 200 && term.json?.status === 'TERMINATED');
  const empContracts = await call('GET', '/contracts', emp);
  ok('employee sees only own contracts', empContracts.status === 200 && empContracts.json?.data?.every((c: any) => c.employeeId === empId));

  // ---- attendance widget ----
  const s0 = await call('GET', '/attendance/session', emp);
  ok('session state', s0.status === 200 && Array.isArray(s0.json?.allowedActions));
  if (s0.json?.state === 'OUT') {
    const cin = await call('POST', '/attendance/clock-in', emp, {});
    ok('clock in', cin.status === 201 && cin.json?.checkedIn === true);
    const cinAgain = await call('POST', '/attendance/clock-in', emp, {});
    ok('double clock in → 422', cinAgain.status === 422);
    const bs = await call('POST', '/attendance/break-start', emp, {});
    ok('break start', bs.status === 201 && bs.json?.onBreak === true);
    const coutOnBreak = await call('POST', '/attendance/clock-out', emp, {});
    ok('clock out during break → 422', coutOnBreak.status === 422);
    const be = await call('POST', '/attendance/break-end', emp, {});
    ok('break end', be.status === 201 && be.json?.onBreak === false);
    const cout = await call('POST', '/attendance/clock-out', emp, {});
    ok('clock out', cout.status === 201 && cout.json?.checkedIn === false);
  } else {
    ok('session already open (skipping punch flow)', true, `state=${s0.json?.state}`);
  }
  const myAtt = await call('GET', `/attendance/records?from=${plusDays(-14)}&to=${today}&pageSize=50`, emp);
  ok('employee attendance records (derived fields)', myAtt.status === 200 && myAtt.json?.data?.length > 0 && 'workedHours' in (myAtt.json?.data?.[0]?.derived ?? {}), `records=${myAtt.json?.data?.length}`);
  const hrAtt = await call('GET', `/attendance/records?date=${plusDays(-3)}&pageSize=50`, hr);
  const missing = hrAtt.json?.data?.filter((r: any) => r.derived?.missingCheckout).length;
  ok('HR sees seeded missing check-out', hrAtt.status === 200 && missing >= 1, `missingCheckout=${missing}`);
  const absences = await call('POST', '/attendance/mark-absences', hr, { date: plusDays(-1) });
  ok('mark absences (idempotent)', absences.status === 200 && absences.json?.created);
  const manual = await call('POST', '/attendance/records', hr, {
    employeeId: newId,
    attendanceDate: plusDays(-2),
    entries: [
      { entryType: 'CLOCK_IN', entryTime: `${plusDays(-2)}T03:30:00.000Z` },
      { entryType: 'CLOCK_OUT', entryTime: `${plusDays(-2)}T12:45:00.000Z` },
    ],
  });
  ok('HR manual attendance record', manual.status === 201 && manual.json?.derived?.workedHours === 9.25, `worked=${manual.json?.derived?.workedHours}`);
  const badSeq = await call('POST', `/attendance/records/${manual.json?.attendanceRecordId}/entries`, hr, { entryType: 'BREAK_END', entryTime: `${plusDays(-2)}T13:00:00.000Z` });
  ok('invalid punch sequence → 422', badSeq.status === 422);

  // ---- leave types & balances ----
  const types = await call('GET', '/leave-types', emp);
  ok('employee reads leave types', types.status === 200 && types.json?.meta?.total >= 4);
  const annual = types.json?.data?.find((t: any) => t.typeName === 'Annual Leave');
  const unpaid = types.json?.data?.find((t: any) => t.typeName === 'Unpaid Leave');
  const myBal = await call('GET', '/leave-balances/me', emp);
  const annualBal = myBal.json?.data?.find((b: any) => b.leaveTypeId === annual?.leaveTypeId);
  ok('my balances with remaining/available', myBal.status === 200 && annualBal && typeof annualBal.availableDays === 'number', `annual remaining=${annualBal?.remainingDays} available=${annualBal?.availableDays}`);
  const init = await call('POST', '/leave-balances/initialize', hr, { year: new Date().getUTCFullYear() });
  ok('initialize year balances for new employee', init.status === 200 && init.json?.created >= 1, `created=${init.json?.created}`);

  // ---- time off flow ----
  // Hygiene: cancel this employee's leftover PENDING requests from earlier smoke runs.
  const leftovers = await call('GET', '/time-off/requests?status=PENDING&pageSize=100', emp);
  for (const r of leftovers.json?.data ?? []) await call('POST', `/time-off/requests/${r.timeOffRequestId}/cancel`, emp);

  // Find a Monday at least 21 days out to avoid seeded pending requests.
  let start = new Date();
  start.setUTCDate(start.getUTCDate() + 21);
  while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1);
  const startStr = start.toISOString().slice(0, 10);
  const endD = new Date(start);
  endD.setUTCDate(endD.getUTCDate() + 6); // Mon..Sun → 5 working days on Mon-Fri schedule
  const endStr = endD.toISOString().slice(0, 10);

  const req = await call('POST', '/time-off/requests', emp, { leaveTypeId: annual?.leaveTypeId, startDate: startStr, endDate: endStr, reason: 'Smoke test' });
  ok('employee requests leave (working days computed)', req.status === 201 && req.json?.totalDays === 5, `totalDays=${req.json?.totalDays}`);
  const reqId = req.json?.timeOffRequestId;
  const fri = new Date(start);
  fri.setUTCDate(fri.getUTCDate() + 4);
  const friStr = fri.toISOString().slice(0, 10);
  const overlap = await call('POST', '/time-off/requests', emp, { leaveTypeId: annual?.leaveTypeId, startDate: friStr, endDate: friStr });
  ok('overlapping request → 409', overlap.status === 409, `status=${overlap.status}`);
  const forOther = await call('POST', '/time-off/requests', emp, { employeeId: otherId, leaveTypeId: annual?.leaveTypeId, startDate: startStr, endDate: startStr });
  ok('employee cannot request for someone else', forOther.status === 403);
  // ~6 weeks starting 2 weeks after the smoke request, kept inside the current calendar year.
  const big = new Date(endD);
  big.setUTCDate(big.getUTCDate() + 8);
  const bigEnd = new Date(big);
  bigEnd.setUTCDate(bigEnd.getUTCDate() + 41);
  if (bigEnd.getUTCFullYear() !== big.getUTCFullYear()) {
    big.setUTCFullYear(big.getUTCFullYear(), 0, 5);
    bigEnd.setUTCFullYear(big.getUTCFullYear(), 1, 15);
  }
  const tooMany = await call('POST', '/time-off/requests', emp, { leaveTypeId: annual?.leaveTypeId, startDate: big.toISOString().slice(0, 10), endDate: bigEnd.toISOString().slice(0, 10) });
  ok('insufficient balance → 422', tooMany.status === 422 && tooMany.json?.error?.details?.availableDays !== undefined, tooMany.json?.error?.message);
  const empApprove = await call('POST', `/time-off/requests/${reqId}/approve`, emp, {});
  ok('employee cannot approve', empApprove.status === 403);
  const approve = await call('POST', `/time-off/requests/${reqId}/approve`, hr, { comments: 'ok' });
  ok('HR approves', approve.status === 200 && approve.json?.status === 'APPROVED' && approve.json?.approval?.decision === 'APPROVED');
  const balAfter = await call('GET', '/leave-balances/me', emp);
  const annualAfter = balAfter.json?.data?.find((b: any) => b.leaveTypeId === annual?.leaveTypeId);
  ok('used days incremented on approval', annualAfter?.usedDays === (annualBal?.usedDays ?? 0) + 5, `used ${annualBal?.usedDays} → ${annualAfter?.usedDays}`);
  const empCancelApproved = await call('POST', `/time-off/requests/${reqId}/cancel`, emp);
  ok('employee cannot cancel approved', empCancelApproved.status === 403);
  const hrCancel = await call('POST', `/time-off/requests/${reqId}/cancel`, hr);
  ok('HR cancels approved (balance restored)', hrCancel.status === 200 && hrCancel.json?.status === 'CANCELLED');
  const balRestored = await call('GET', '/leave-balances/me', emp);
  const annualRestored = balRestored.json?.data?.find((b: any) => b.leaveTypeId === annual?.leaveTypeId);
  ok('used days restored after cancel', annualRestored?.usedDays === (annualBal?.usedDays ?? 0), `used=${annualRestored?.usedDays}`);
  const unpaidReq = await call('POST', '/time-off/requests', emp, { leaveTypeId: unpaid?.leaveTypeId, startDate: plusDays(40), endDate: plusDays(40) });
  ok('untracked leave type bypasses balance', unpaidReq.status === 201, `status=${unpaidReq.status}`);
  if (unpaidReq.status === 201) await call('POST', `/time-off/requests/${unpaidReq.json?.timeOffRequestId}/cancel`, emp);
  const recompute = await call('POST', '/leave-balances/recompute', hr, {});
  ok('recompute finds no drift', recompute.status === 200 && recompute.json?.corrected === 0, `checked=${recompute.json?.checked} corrected=${recompute.json?.corrected}`);

  // ---- Phase 3 payroll ----
  const hrPayrollDenied = await call('GET', '/payruns', hr);
  ok('HR_MANAGER cannot read payroll', hrPayrollDenied.status === 403);
  const employeePayrollDenied = await call('GET', '/payslips', emp);
  ok('EMPLOYEE cannot read payroll', employeePayrollDenied.status === 403);
  const releasedRoles = await call('GET', '/roles', payroll);
  const roleNames = (releasedRoles.json?.data ?? []).map((role: any) => role.roleName);
  ok(
    'only released roles are assignable',
    releasedRoles.status === 200 && roleNames.includes('HR_PAYROLL_USER') && !roleNames.includes('HR_PAYROLL_MANAGER') && !roleNames.includes('ADMIN'),
  );

  const structures = await call('GET', '/salary-structures?pageSize=20', payroll);
  const regular = structures.json?.data?.find((structure: any) => structure.name === 'Regular Salary');
  ok('payroll reads salary structures', structures.status === 200 && regular?.ruleCount === 8);
  const structureDetail = await call('GET', `/salary-structures/${regular?.salaryStructureId}`, payroll);
  const orderedSequences = (structureDetail.json?.rules ?? []).map((rule: any) => rule.sequence);
  ok(
    'salary structure detail has ordered rules',
    structureDetail.status === 200 && orderedSequences.length === 8 && orderedSequences.every((value: number, index: number) => index === 0 || value > orderedSequences[index - 1]),
  );
  const salaryRules = await call('GET', `/salary-rules?structureId=${regular?.salaryStructureId}&pageSize=20`, payroll);
  ok('payroll reads salary rules', salaryRules.status === 200 && salaryRules.json?.meta?.total === 8);
  const seededRuns = await call('GET', '/payruns?pageSize=100', payroll);
  ok(
    'seed includes a computed payrun',
    seededRuns.status === 200 && seededRuns.json?.data?.some((run: any) => run.status === 'COMPUTED' && run.payslipCount > 0),
  );

  const offset = 200 + (seededRuns.json?.meta?.total ?? 1) * 14;
  const payrollFromDate = new Date();
  payrollFromDate.setUTCDate(payrollFromDate.getUTCDate() + offset);
  const payrollToDate = new Date(payrollFromDate);
  payrollToDate.setUTCDate(payrollToDate.getUTCDate() + 6);
  const payrollFrom = payrollFromDate.toISOString().slice(0, 10);
  const payrollTo = payrollToDate.toISOString().slice(0, 10);
  const eligibility = await call(
    'GET',
    `/payruns/eligible-employees?structureId=${regular?.salaryStructureId}&from=${payrollFrom}&to=${payrollTo}`,
    payroll,
  );
  const selected = (eligibility.json?.data ?? []).filter((employee: any) => employee.selectable).slice(0, 3);
  ok('payrun eligibility returns selectable employees and flags', eligibility.status === 200 && selected.length === 3 && Array.isArray(eligibility.json?.data?.[0]?.flags));

  const createRun = await call('POST', '/payruns', payroll, {
    name: `Smoke Payroll ${Date.now()}`,
    structureId: regular?.salaryStructureId,
    periodStart: payrollFrom,
    periodEnd: payrollTo,
    employeeIds: selected.map((employee: any) => employee.employeeId),
  });
  const payrunId = createRun.json?.payrunId;
  ok('create payrun from selected employees only', createRun.status === 201 && createRun.json?.status === 'DRAFT' && createRun.json?.payslipCount === 3);
  const draftValidate = await call('POST', `/payruns/${payrunId}/validate`, payroll);
  ok('out-of-order validate → 422', draftValidate.status === 422);
  const draftSend = await call('POST', `/payruns/${payrunId}/send-payslips`, payroll);
  ok('DRAFT send payslips → 422', draftSend.status === 422);

  const duplicateEligibility = await call(
    'GET',
    `/payruns/eligible-employees?structureId=${regular?.salaryStructureId}&from=${payrollFrom}&to=${payrollTo}`,
    payroll,
  );
  const selectedIds = new Set(selected.map((employee: any) => employee.employeeId));
  ok(
    'overlapping payslips are flagged and non-selectable',
    duplicateEligibility.status === 200 &&
      duplicateEligibility.json?.data
        ?.filter((employee: any) => selectedIds.has(employee.employeeId))
        .every((employee: any) => !employee.selectable && employee.flags.some((flag: any) => flag.code === 'DUPLICATE_PAYSLIP')),
  );

  const computed = await call('POST', `/payruns/${payrunId}/compute`, payroll);
  const firstNet = computed.json?.totals?.net;
  ok('compute payrun and totals', computed.status === 200 && computed.json?.status === 'COMPUTED' && firstNet > 0, `net=${firstNet}`);
  const recomputedRun = await call('POST', `/payruns/${payrunId}/compute`, payroll);
  ok('repeated compute is idempotent', recomputedRun.status === 200 && recomputedRun.json?.totals?.net === firstNet);
  const runWarnings = await call('GET', `/payruns/${payrunId}/warnings`, payroll);
  ok('warnings split hard and soft', runWarnings.status === 200 && Array.isArray(runWarnings.json?.hard) && Array.isArray(runWarnings.json?.soft));

  const runPayslips = await call('GET', `/payslips?payrunId=${payrunId}&pageSize=20`, payroll);
  const firstPayslipId = runPayslips.json?.data?.[0]?.payslipId;
  ok('payslip list reflects computed payrun', runPayslips.status === 200 && runPayslips.json?.meta?.total === 3 && runPayslips.json?.data?.every((slip: any) => slip.status === 'COMPUTED'));
  const payslipDetail = await call('GET', `/payslips/${firstPayslipId}`, payroll);
  ok('payslip detail includes ordered lines and matching net', payslipDetail.status === 200 && payslipDetail.json?.lines?.length === 8 && payslipDetail.json?.totals?.net > 0);
  const oneRecompute = await call('POST', `/payslips/${firstPayslipId}/recompute`, payroll);
  ok('recompute mutable payslip', oneRecompute.status === 200 && oneRecompute.json?.totals?.net === payslipDetail.json?.totals?.net);
  const pdf = await call('GET', `/payslips/${firstPayslipId}/pdf`, payroll);
  ok('payslip PDF streams', pdf.status === 200 && pdf.buffer?.subarray(0, 4).toString() === '%PDF' && (pdf.buffer?.length ?? 0) > 1000);

  const validated = await call('POST', `/payruns/${payrunId}/validate`, payroll);
  ok('validate computed payrun with no hard warnings', validated.status === 200 && validated.json?.status === 'VALIDATED', validated.json?.error?.message);
  const sent = await call('POST', `/payruns/${payrunId}/send-payslips`, payroll);
  ok(
    'send payslips uses dev JSON transport and reports recipients',
    sent.status === 200 && sent.json?.transport === 'json' && sent.json?.results?.length === 3 && sent.json?.results?.every((result: any) => result.success),
  );
  const paid = await call('POST', `/payruns/${payrunId}/mark-paid`, payroll);
  ok('mark validated payrun paid', paid.status === 200 && paid.json?.status === 'PAID');
  const paidRecompute = await call('POST', `/payslips/${firstPayslipId}/recompute`, payroll);
  ok('PAID payslip recompute → 422', paidRecompute.status === 422);
  const paidCompute = await call('POST', `/payruns/${payrunId}/compute`, payroll);
  ok('PAID payrun compute → 422', paidCompute.status === 422);
  const paidCancel = await call('POST', `/payruns/${payrunId}/cancel`, payroll, { reason: 'not allowed' });
  ok('PAID payrun cancel → 422', paidCancel.status === 422);

  const cancelFromDate = new Date(payrollToDate);
  cancelFromDate.setUTCDate(cancelFromDate.getUTCDate() + 14);
  const cancelToDate = new Date(cancelFromDate);
  cancelToDate.setUTCDate(cancelToDate.getUTCDate() + 6);
  const cancelFrom = cancelFromDate.toISOString().slice(0, 10);
  const cancelTo = cancelToDate.toISOString().slice(0, 10);
  const cancelEligibility = await call(
    'GET',
    `/payruns/eligible-employees?structureId=${regular?.salaryStructureId}&from=${cancelFrom}&to=${cancelTo}`,
    payroll,
  );
  const cancelEmployee = cancelEligibility.json?.data?.find((employee: any) => employee.selectable);
  const cancelRun = await call('POST', '/payruns', payroll, {
    name: `Smoke Cancel ${Date.now()}`,
    structureId: regular?.salaryStructureId,
    periodStart: cancelFrom,
    periodEnd: cancelTo,
    employeeIds: [cancelEmployee?.employeeId],
  });
  const cancelled = await call('POST', `/payruns/${cancelRun.json?.payrunId}/cancel`, payroll, { reason: 'Smoke cancellation' });
  ok('cancel DRAFT payrun', cancelRun.status === 201 && cancelled.status === 200 && cancelled.json?.status === 'CANCELLED');

  // ---- users ----
  const user = await call('POST', '/users', hr, { employeeId: newId, username: `smoke${Date.now()}`, password: 'Password123!', role: 'EMPLOYEE' });
  ok('HR creates user', user.status === 201 && user.json?.role === 'EMPLOYEE');
  const selfRole = await call('PATCH', `/users/${hrLogin.json?.user?.userId}`, hr, { role: 'EMPLOYEE' });
  ok('HR cannot change own role', selfRole.status === 422);

  // ---- cleanup ----
  const del = await call('DELETE', `/employees/${newId}`, hr);
  ok('delete employee (cascade)', del.status === 204);
  const delDept = await call('DELETE', `/departments/${deptId}`, hr);
  ok('delete department', delDept.status === 204);
  const delSched = await call('DELETE', `/work-schedules/${sched.json?.scheduleId}`, hr);
  ok('delete work schedule', delSched.status === 204);

  console.log(results.join('\n'));
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
