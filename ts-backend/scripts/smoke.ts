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
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
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
