# PeoplePay360 — Overall Implementation Plan & Status

**Last audited:** 2026-09-05 (P1/P2 combined build, typecheck, lint, unit tests, migration/seed and smoke verified).
**Companion docs:** `docs/build-plan.md` (**the executable step-by-step queue derived from this file — start there**), `docs/phase-1-plan.md` (detailed schema, rules and API for Phases 1–2), `pp360.txt` (problem statement), `HRMS OXP - 24 hours.excalidraw` (mockup), `ts-backend/README.md` (run instructions).

**Legend**

| Mark | Meaning |
|---|---|
| ✅ | Implemented **and** verified (typecheck, migration, seed or smoke check) |
| 🟡 | Partially done, or done but not verified |
| ❌ | Not started |
| ⏳ | Blocked — waiting for the team schema for that phase |
| 📝 | Decision or input needed from the team |

---

## 0. Role → Phase flow (from the handwritten sketch + PDF §3)

The sketch numbers the roles ① → ⑤ and shows the access hierarchy on the back page. **Each phase delivers one role.** Phases 1 and 2 were planned and built together (see `docs/phase-1-plan.md`).

```
⑤ ADMIN                 CRUD access to everything (users, roles, permissions, all modules)
   ▲
④ HR PAYROLL MANAGER    CRUD access — read & write payroll records AND payroll config
   ▲                    (salary structures, salary rules, payruns, payslips)
③ HR PAYROLL USER       HR Manager + Create/Read/Update payruns & payslips,
   ▲                    read-only salary structures & rules
② HR MANAGER            CRUD on employees, attendance, contracts, working schedules,
   ▲                    time off (approve / reject). No payroll.
① EMPLOYEE              Own details, own attendance (clock in/out), own leave balances,
                        own time off requests. No HR admin, no payroll.
```

| Phase | Role (enum value) | Team schema | Backend | Frontend | Plan doc |
|---|---|---|---|---|---|
| 1 | ① `EMPLOYEE` | ✅ received 2026-09-05 | ✅ | ✅ P1-1…P1-5 implemented; combined P1/P2 gate passed | `docs/phase-1-plan.md` |
| 2 | ② `HR_MANAGER` | ✅ (same schema as Phase 1) | ✅ | ✅ FE-1…FE-6 and P2-1…P2-10 implemented; combined gate passed | `docs/phase-1-plan.md` |
| 3 | ③ `HR_PAYROLL_USER` | ⏳ to be given | ⏳ | ❌ | §4 below (scope only) |
| 4 | ④ `HR_PAYROLL_MANAGER` | ⏳ to be given | ⏳ | ❌ | §5 below (scope only) |
| 5 | ⑤ `ADMIN` | ⏳ to be given | ⏳ | ❌ | §6 below (scope only) |

Cross-phase work (frontend shell, tests, docs, demo) is tracked in §7. Open decisions are in §8. The "schema arrives" playbook is §9.

---

## 1. Repository snapshot (verified 2026-09-05)

| Area | State | Evidence |
|---|---|---|
| `ts-backend/` app code | ✅ Express 5 + TypeScript 7, 11 modules, layered `router/schema/service` | `src/routes.ts`, `src/modules/*` |
| Typecheck | ✅ backend `npm run typecheck`; frontend `npx tsc --noEmit` | combined P1/P2 gate |
| Prisma schema + migration | ✅ 14 application tables, 9 enums, `20260905000000_init` | `prisma/schema.prisma`, `prisma/migrations/` |
| Prisma version | ✅ **6.19.3 pinned**; README and scripts aligned | `package.json`, `ts-backend/README.md` |
| Seed | ✅ roles, 4 departments, 4 leave types, 4 schedules, 9 employees, users, contracts, assignments, balances, 14 days attendance, 5 requests | fresh ephemeral MySQL seed |
| Smoke test | ✅ 57/57 checks against ephemeral MySQL 8.4.9 | `scripts/smoke.ts` |
| Unit tests (vitest) | ✅ 68/68 tests in 4 files | `npm test` |
| OpenAPI / request collection | ❌ | — |
| npm scripts | ✅ Prisma, typecheck, test, smoke, ephemeral DB and generated-client build scripts aligned | `ts-backend/package.json`, README |
| Local DB | ✅ ephemeral MySQL 8.4.9 migration/seed/smoke verified; no persistent local MySQL/Docker required | `scripts/ephemeral-db.ts` |
| `frontend/` | ✅ Next.js 16.3.4 P1/P2 application; Webpack production build, typecheck and lint green | `frontend/app`, `frontend/components`, `frontend/lib` |
| Git | Uncommitted P1/P2 implementation and planning updates present; no commit was requested | `git status --short` |

---

## 2. Phase 1 + 2 — EMPLOYEE & HR_MANAGER (backend ✅, frontend ✅)

### 2.1 Foundation

| Item | Status |
|---|---|
| Express 5 app, `helmet`, `cors` (credentials, env origin), `cookie-parser`, `pino-http` | ✅ `src/app.ts` |
| Zod-validated env at boot (`DATABASE_URL`, JWT, TTLs, `DEFAULT_CURRENCY`, `APP_TIMEZONE`, `LATE_GRACE_MINUTES`, seed creds) | ✅ `src/config/env.ts` |
| Prisma client + MariaDB driver adapter, `prisma.config.ts` with seed hook | ✅ |
| `AppError` hierarchy → `{ error: { code, message, details } }`; Prisma P2002/P2025 mapped to 409/404 | ✅ `src/lib/errors.ts`, `middleware/error-handler.ts` |
| `validate()` middleware, list conventions `page/pageSize/sort/order/q` → `{ data, meta }` | ✅ `src/lib/validation.ts`, `src/lib/http.ts` |
| Date helpers (timezone-aware "today", ISO weekday, TIME parsing) | ✅ `src/lib/dates.ts` |
| `GET /api/v1/health` with DB probe | ✅ smoke `health` |
| `docker-compose.yml` (MySQL 8.4) + ephemeral DB script | ✅ |

### 2.2 Auth & RBAC

| Item | Status |
|---|---|
| bcrypt (12 rounds) password hashes | ✅ |
| JWT access token (HS256, env TTL) carrying `userId, employeeId, role, username` | ✅ |
| Rotating opaque refresh token, SHA-256 hash in `refresh_tokens`, httpOnly cookie scoped to `/api/v1/auth` | ✅ smoke `refresh token rotation`, `reused refresh token rejected` |
| `POST /auth/login` (username **or** work email), `/refresh`, `/logout`, `GET /auth/me` | ✅ smoke `HR login`, `employee login (by email)`, `bad password rejected`, `GET /auth/me` |
| `last_login_at` updated on login | ✅ |
| Permission catalogue (19 permissions) + `ROLE_PERMISSIONS` map for `EMPLOYEE`, `HR_MANAGER` | ✅ `src/auth/permissions.ts` |
| `authenticate` + `authorize(...permissions)` middleware | ✅ |
| Row-level scoping for EMPLOYEE via `scopeToEmployee()` / `requireEmployeeScope()` | ✅ smoke `employee sees only self`, `employee cannot read another employee`, `employee sees only own contracts`, `employee cannot request for someone else` |
| Users cannot change own role / deactivate self; deactivation & password change revoke sessions | ✅ smoke `HR cannot change own role` |
| Role enum limited to `EMPLOYEE`, `HR_MANAGER` | 🟡 must be extended in Phases 3–5 (migration) |

### 2.3 Data model (14 tables, all migrated ✅)

| Table | Status | Notes |
|---|---|---|
| `roles` | ✅ | enum `RoleName(EMPLOYEE, HR_MANAGER)` |
| `departments` | ✅ | |
| `leave_types` | ✅ | `default_annual_days` drives yearly balances; 0 = not balance-tracked |
| `work_schedules` | ✅ | `days_of_week` as JSON (MySQL has no arrays); `weekly_hours` derived |
| `employees` | ✅ | hub; self-FK manager; status enum |
| `users` | ✅ | one `role_id` per user; `username` = work email in seed |
| `refresh_tokens` | ✅ | added beyond team schema |
| `contracts` | ✅ | `currency` default from env; `created_by` |
| `employee_schedule_assignments` | ✅ | effective-dated, unique (employee, from) |
| `leave_balances` | ✅ | remaining derived, never stored |
| `time_off_requests` | ✅ | `total_days` computed by service |
| `time_off_approvals` | ✅ | one decision per request |
| `attendance_records` | ✅ | one row per employee per day |
| `attendance_entries` | ✅ | raw punches, `source` enum |

Deviations from the team SQL (all forced or additive) are listed in `docs/phase-1-plan.md` §4.3.

### 2.4 Modules & endpoints (`/api/v1`)

| Module | Endpoints | Status |
|---|---|---|
| Users / roles | `GET/POST /users`, `GET/PATCH /users/:id`, `GET /roles` | ✅ smoke `HR creates user`, `employee cannot manage users` |
| Departments | `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id` | ✅ smoke `create department`, `duplicate department → 409`, `delete department` |
| Leave types | `GET/POST /leave-types`, `GET/PATCH/DELETE /leave-types/:id` | ✅ smoke `employee reads leave types` |
| Work schedules | `GET/POST /work-schedules`, `GET/PATCH/DELETE /work-schedules/:id` | ✅ smoke `create work schedule (derived weekly hours)`, `invalid schedule → 400`, `delete work schedule` |
| Employees | `GET /employees/me`, `/me/summary`, `/me/schedule`, `GET/POST /employees`, `GET/PATCH/DELETE /employees/:id`, `GET /employees/:id/summary`, `POST /employees/:id/terminate`, `GET /employees/:id/contracts` | ✅ smoke `create employee`, `self-manager rejected`, `employee summary`, `delete employee (cascade)` |
| Schedule assignments | `GET/POST /employees/:id/schedule-assignments`, `PATCH/DELETE /schedule-assignments/:id` | ✅ smoke `assign schedule`, `overlapping assignment → 409` |
| Contracts | `GET/POST /contracts` (filters `employeeId, status, contractType, activeOn`), `GET/PATCH/DELETE /contracts/:id`, `POST /contracts/:id/terminate` | ✅ smoke `create contract (currency from env)`, `overlapping ACTIVE contract → 409`, `terminate contract` |
| Attendance | `GET /attendance/session`, `POST /attendance/clock-in|clock-out|break-start|break-end`, `GET/POST /attendance/records`, `GET/PATCH/DELETE /attendance/records/:id`, `POST /attendance/records/:id/entries`, `PATCH/DELETE /attendance/entries/:id`, `POST /attendance/mark-absences` | ✅ smoke `session state`, `clock in`, `double clock in → 422`, `break start`, `clock out during break → 422`, `break end`, `clock out`, `employee attendance records (derived fields)`, `HR sees seeded missing check-out`, `mark absences (idempotent)`, `HR manual attendance record`, `invalid punch sequence → 422` |
| Leave balances | `GET /leave-balances/me`, `GET/POST /leave-balances`, `GET/PATCH/DELETE /leave-balances/:id`, `POST /leave-balances/initialize`, `POST /leave-balances/recompute` | ✅ smoke `my balances with remaining/available`, `initialize year balances for new employee`, `recompute finds no drift` |
| Time off | `GET/POST /time-off/requests`, `GET/PATCH /time-off/requests/:id`, `POST …/:id/approve|reject|cancel`, `GET …/:id/approval` | ✅ smoke `employee requests leave (working days computed)`, `overlapping request → 409`, `insufficient balance → 422`, `employee cannot approve`, `HR approves`, `used days incremented on approval`, `employee cannot cancel approved`, `HR cancels approved (balance restored)`, `used days restored after cancel`, `untracked leave type bypasses balance` |

### 2.5 Business rules (all in services, nothing hardcoded)

| Rule | Status | Where |
|---|---|---|
| `weekly_hours = |days| × (end − start)`, recomputed on save; days unique within 1–7; `end > start` | ✅ | `modules/work-schedules` |
| Schedule assignments never overlap; new open assignment closes previous; `getScheduleFor(employeeId, date)` resolver | ✅ | `modules/employees/service.ts`, `work-schedules/resolve.ts` |
| One ACTIVE contract per employee per period; read-time + `expireContracts()` auto-expiry; `terminate`; `created_by` = acting HR | ✅ | `modules/contracts/service.ts` |
| **`getActiveContract(employeeId, date)`** — the resolver payroll (Phase 3) reuses | ✅ | `modules/contracts/service.ts` |
| Punch state machine (clock in/out, break start/end pairing); widget punches `WEB`, HR edits `MANUAL` | ✅ | `modules/attendance/derive.ts` |
| Derived per day: `worked_hours`, `break_hours`, `expected_hours` (from schedule), `overtime`, `is_late` (grace from env), `missing_checkout` | ✅ | `modules/attendance/derive.ts` |
| `markAbsences(date)`: ABSENT / ON_LEAVE / WEEK_OFF, idempotent | ✅ | `modules/attendance/service.ts` |
| Employee = punch + read own; edit/delete = HR only | ✅ | permissions + services |
| `remaining = allocated + carried_forward − used`; `pending`; `available = remaining − pending` | ✅ | `modules/leave-balances/service.ts` |
| `initializeYear(year)` from `leave_types.default_annual_days`, optional carry-forward | ✅ | same |
| `recompute` verifies `used_days` against APPROVED requests | ✅ | same |
| `total_days` = working days per employee schedule; no overlap with PENDING/APPROVED; single calendar year | ✅ | `modules/time-off/service.ts` |
| Balance check on submit and on approve; approval row + status flip + `used_days` in one transaction | ✅ | same |
| Cancel: owner while PENDING; HR while PENDING/APPROVED (restores balance) | ✅ | same |
| Email unique; manager ≠ self; TERMINATED sets `termination_date` and deactivates user | ✅ | `modules/employees/service.ts` |
| Smart-button counts (contracts, attendance, requests, balances) from one aggregate | ✅ | `GET /employees/:id/summary` |

### 2.6 Seed & tooling

| Item | Status |
|---|---|
| Idempotent lookup seed (roles, departments, leave types, schedules) | ✅ |
| Transactional demo data only when DB has no employees | ✅ |
| Seeded logins: `hr.manager` (HR_MANAGER), every employee's work email (EMPLOYEE) | ✅ |
| Smoke test walking every module and rule | ✅ `scripts/smoke.ts` |
| **vitest unit tests** on pure attendance, date, schedule and permission rules | ✅ 68/68 tests in 4 files |
| **OpenAPI spec / Postman collection** | ❌ |
| `package.json` scripts aligned with README (`prisma:*`, `typecheck`, `test`, generated-client build) | ✅ |
| README Prisma version pinned to installed 6.19.3 | ✅ |

### 2.7 Frontend screens for Phases 1–2 (mockup sections 0–3) — verified ✅

Navigation and route/button authorization are permission-driven from the authenticated session; shared routes preserve employee row scoping while exposing HR controls only to write/decision permissions.

| Mockup screen | Route | Roles | Status |
|---|---|---|---|
| 0) Login (work email + password, accounts created by admin/HR) | `/login` | all | ✅ |
| App shell: role-aware nav, header with user name, attendance status | `(app)/layout` | all | ✅ |
| Attendance popup widget: session-aware clock in/out and breaks | header | all | ✅ |
| 1) Employees Kanban (default) + List | `/employees` | H | ✅ |
| Employee Form: identity header, Work/Private tabs, smart links and lifecycle actions | `/employees/[id]`, `/employees/new`, `/employees/me` | H; E own read | ✅ |
| Departments list + form | `/departments` | H | ✅ |
| Working Schedules CRUD + assignment history | `/work-schedules` | H | ✅ |
| Contracts list/detail/form with current emphasis and employee own-read mode | `/contracts`, `/contracts/[id]` | H; E own read | ✅ |
| 2) Attendance list/detail with HR corrections and employee own-read mode | `/attendance`, `/attendance/[id]` | H; E own | ✅ |
| 3) Time Off requests, employee create/edit/cancel and HR decisions | `/time-off/requests`, `/time-off/requests/[id]` | H; E own | ✅ |
| Leave allocations with own-read mode plus HR CRUD/initialize/recompute | `/time-off/balances` | H; E own read | ✅ |
| Time Off Types CRUD | `/time-off/types` | H | ✅ |
| Time Off dashboard / My Space summaries and quick actions | `/time-off`, `/` | E; HR redirects to roster | ✅ |
| Users: link employee, create login, role/active/password management | `/users` | H | ✅ |

Frontend stack: Next.js 16 App Router, Tailwind 4, shadcn/ui, TanStack Query, react-hook-form + zod, and a typed API client with refresh-on-401. Combined evidence: Webpack production build passed twice; `npx tsc --noEmit` and `npm run lint` passed; all expected static and dynamic P1/P2 routes were generated. The default Turbopack build exits abnormally with code `-1` on this Windows machine, so `npm run build -- --webpack` is the verified fallback.

### 2.8 Mockup items deliberately **not** built in Phases 1–2 (decision 2026-09-05: schema is source of truth)

| Mockup / PDF item | Decision |
|---|---|
| Time Off Type unit (days/hours), requires-allocation flag, approval-by, colour, active | 📝 Not in schema. Candidate additive columns `requires_balance`, `is_active` if the team agrees. |
| Allocations requiring approval before use | Accepted: HR creating the balance **is** the approval. |
| Contract reference `CON/2026/0042`, job position, salary structure on contract | Reference number optional later; **salary structure link arrives with the Phase 3/4 schema** (`contracts.salary_structure_id` or on payrun). |
| Five roles / multi-role users | Single `role_id` per user; enum extended per phase. Multi-role is a 📝 for Phase 5. |
| LATE attendance status, edit audit | Derived `is_late`, `missing_checkout`; `source = MANUAL` marks HR edits. |
| Requests spanning two calendar years | Rejected with a clear message. |
| User deletion | No backend `DELETE /users/:id`; P2-10 uses activation/deactivation only. Employee hard-delete remains the separate cascade path. |
| Immediate account deactivation | Refresh tokens are revoked, but an issued access token stays valid until expiry; the UI states this limitation. |
| Referenced leave-type deletion | Backend returns 422 `BUSINESS_RULE_VIOLATION` (not the stale planned 409); the UI displays the exact API message. |
| Frontend production builder | Default Turbopack exits abnormally on this Windows host; the Webpack fallback passed twice and is the documented gate. |

---

## 3. Payroll foundations already in place (reused by Phases 3–4)

These exist today and must **not** be re-implemented:

| Capability | Location | Used by |
|---|---|---|
| `getActiveContract(employeeId, date)` → wage & currency for the period | `modules/contracts/service.ts` | payslip computation |
| `getScheduleFor(employeeId, date)` + working-day test | `work-schedules/resolve.ts`, `employees/service.ts` | expected days / hours per period |
| Attendance derivation (worked, overtime, late, missing check-out) | `attendance/derive.ts` | worked days, attendance-based rules, dashboard |
| Approved time off & leave types (`default_annual_days = 0` = unpaid) | `time-off`, `leave-balances` | unpaid-leave deductions, dashboard |
| `employees.department_id`, `contracts.contract_type` | schema | dashboard filters (Department, Employee Type) |
| Permission catalogue + `authorize()` | `auth/permissions.ts` | add `payroll:*` permissions |
| List conventions, error envelope, validation | `lib/*` | all new modules |

---

## 4. Phase 3 — HR_PAYROLL_USER (payruns & payslips) ⏳ schema pending

**Access (PDF §3 + sketch):** everything HR_MANAGER has, **plus Create / Read / Update** on Payruns and Payslips, **read-only** Salary Structures and Salary Rules. No delete on payroll records, no config edits.

### 4.1 Mockup screens (section 4 "Payroll — Payrun & Payslips")

| Screen | Key content | Status |
|---|---|---|
| Payroll ▼ menu: Payruns, Payslips, Salary Structures, Salary Rules, Dashboard | role-filtered | ❌ |
| Payruns list | name, structure, period, status, #payslips; search | ❌ |
| **New Pay Run wizard — Step 1** (popup) | scope: Salary Structure, Period (from/to or month), employee type filter; **Continue does not create anything** | ❌ |
| **Step 2** employee selection | eligible employees (ACTIVE, active contract in period, not already in a payrun for the period); multi-select; **Create Payrun** creates the batch with only selected employees | ❌ |
| Payrun form | run name, structure, period, status; actions **COMPUTE → VALIDATE → MARK PAID → SEND PAYSLIPS**; payslip list; warnings panel | ❌ |
| Payslips list | employee, structure, payrun, period, status, worked days; search; period filter | ❌ |
| Payslip form | identification block + **Salary Computation** table (rule, category, amount) with Basic / Allowances / Deductions / Gross / Net; **PRINT PAYSLIP** (PDF) | ❌ |
| Salary Structures / Rules | read-only list + form for this role | ❌ |

### 4.2 Business rules to implement (from PDF §4 B5–B8, mockup notes)

| Rule | Status |
|---|---|
| Payrun lifecycle `DRAFT → COMPUTED → VALIDATED → PAID` (+ `CANCELLED`); transitions guarded; PAID/VALIDATED immutable history | ❌ |
| Wizard: two steps, record created only on "Create Payrun", only selected employees included | ❌ |
| Eligibility: ACTIVE employee **and** `getActiveContract(employeeId, periodEnd)` exists; exclude employees already on a payslip for an overlapping period (duplicate warning otherwise) | ❌ |
| Compute: for each payslip take the period contract wage, the payrun's structure, run rules **in sequence**, write payslip lines per rule/category, totals Basic / Allowances / Deductions / Gross / Net | ❌ |
| Worked days / hours from attendance + schedule for the period; unpaid leave days from approved requests of untracked types | ❌ |
| Warnings surfaced before finalization: no active contract, no schedule, missing bank details, duplicate payslip, zero/negative net, unvalidated drafts | ❌ |
| Validate: blocks on hard warnings; Mark Paid: stamps paid date; both preserved as history | ❌ |
| Payslip PDF generation (server-side, e.g. `pdfkit`/`@react-pdf`) | ❌ |
| Send Payslips: bulk email from payrun (nodemailer + SMTP from env; dev = console/Ethereal transport) | ❌ |
| Recompute allowed only while DRAFT/COMPUTED | ❌ |

### 4.3 Expected schema (⏳ **placeholder until the team schema arrives** — replace, do not build from this)

Likely tables: `salary_structures`, `salary_rules` (name, code, category, sequence, computation method fixed / percentage-of-base / formula, active), `salary_structure_rules` (ordering) or `structure_id` on rules, `payruns` (name, structure, period_start, period_end, status, created_by, validated_at, paid_at), `payslips` (payrun, employee, contract, period, status, worked_days, gross, net), `payslip_lines` (payslip, rule, category, sequence, amount), `employee_bank_details` (for the "missing bank account" warning). `RoleName` enum gains `HR_PAYROLL_USER`.

Translation rules for MySQL/Prisma are the same as `docs/phase-1-plan.md` §4.1.

### 4.4 Backend checklist

| Step | Status |
|---|---|
| Extend `RoleName` enum + migration; seed role | ⏳ |
| Add permissions `payroll:read`, `payruns:write`, `payslips:write`, `salary-config:read` and assign to the new role (superset of HR_MANAGER) | ⏳ |
| Modules `payruns`, `payslips`, `salary-structures` (read), `salary-rules` (read) | ⏳ |
| Rule engine (`modules/payroll/engine.ts`): sequence executor, categories, base resolution, **safe formula evaluator (no `eval`)** | ⏳ |
| PDF + email services | ⏳ |
| Seed: one structure ("Regular Salary": Basic, HRA, Standard Allowance, PF, Professional Tax, ESIC, Gross, Net), one computed payrun for last month | ⏳ |
| Smoke checks: wizard, compute, warnings, transitions, role scoping (HR_MANAGER gets 403 on payroll) | ⏳ |

### 4.5 Frontend checklist — all ❌ (screens in 4.1).

---

## 5. Phase 4 — HR_PAYROLL_MANAGER (payroll configuration) ⏳ schema pending

**Access (sketch ④):** CRUD access, "similar to HR Payroll User" plus **read & write on payroll records and config**: full CRUD on Payruns, Payslips, Salary Structures, Salary Rules. Full control over HR and payroll-related records.

> Ordering note: Phase 3 payslips cannot be computed without structures and rules existing. Recommendation 📝: land the **Phase 3 + 4 schema together**; Phase 3 wires read-only access, Phase 4 adds the write side and the dashboard.

### 5.1 Mockup screens (section 5 "Payroll Configuration" and 6 "Payroll Dashboard")

| Screen | Key content | Status |
|---|---|---|
| Salary Structures list | name, #rules, #employees, active; search | ❌ |
| Salary Structure form | details + ordered list of rules (sequence visible, drag or number) | ❌ |
| Salary Rules list | name, code, category, structure, sequence | ❌ |
| Salary Rule form | name, code, category (BASIC / ALLOWANCE / GROSS / DEDUCTION / NET), sequence, computation: Fixed Amount / Percentage of base (Contract Wage, Basic, Gross) / Formula, active | ❌ |
| Payroll Dashboard | KPI cards (Total Net Paid, Payslips Generated with paid/pending, Avg Salary / Employee, Approved Time Off, Attendance Health); charts (Salary Cost by Department, Monthly Net Salary Trend); alerts (missing bank, duplicate payslip, drafts not validated, contracts expiring); Attendance overview (present, late, absent, overtime, missing check-outs, manual edits); Time Off overview (approved days, pending, balances); Department breakdown (headcount + cost); filters Period / Department / Employee Type | ❌ |

### 5.2 Business rules

| Rule | Status |
|---|---|
| Structures are containers; rules reference categories; sequence unique within a structure | ❌ |
| Computation methods: fixed amount, percentage of a named base, formula over earlier categories/rules (mockup: `result = categories['BASIC']`) | ❌ |
| Editing a structure/rule never mutates historic payslips (payslip lines store computed amounts) | ❌ |
| Deactivate instead of delete when referenced by payslips | ❌ |
| Dashboard aggregates **live** data only; every number traceable to a query; filters apply to all widgets | ❌ |

### 5.3 Backend checklist

| Step | Status |
|---|---|
| `RoleName` + `HR_PAYROLL_MANAGER`; permissions `salary-config:write`, `payruns:delete`, `payslips:delete` | ⏳ |
| Write endpoints for structures/rules; delete/cancel for payruns & payslips | ⏳ |
| `modules/dashboard` aggregate queries (`GET /dashboard/payroll?from&to&departmentId&contractType`) | ⏳ |
| Smoke checks incl. HR_PAYROLL_USER 403 on config writes | ⏳ |

### 5.4 Frontend checklist — all ❌ (screens in 5.1; charts via a chart lib, dataviz guidance applies).

---

## 6. Phase 5 — ADMIN (system administration) ⏳ schema pending

**Access (sketch ⑤, PDF §3):** CRUD on everything; user management, role assignment, permission updates, complete system administration.

### 6.1 Mockup screens (section 0 "Login & User Access Flow", *ADMIN ONLY*)

| Screen | Key content | Status |
|---|---|---|
| User Management list | search users / employees / email, role filter; columns user, linked employee, role(s), active, last login | ❌ |
| Create / Edit User | link to employee, username/email, password or invite, **Roles \*** (mockup lists Hr Payroll User, Hr Payroll Admin, Payroll User, Time Off Admin/User, Admin), active toggle; "Create User / Save Access" | 🟡 API exists for single role (`/users`), UI ❌ |
| Roles & permissions view | matrix module × action × role (read-only or editable per 📝) | ❌ |

### 6.2 Business rules

| Rule | Status |
|---|---|
| Users must not assign or elevate their own roles | ✅ already enforced in `users/service.ts` |
| Only ADMIN manages users (today `users:manage` belongs to HR_MANAGER) | 📝 decide: move to ADMIN only, or ADMIN + HR_MANAGER limited to EMPLOYEE role |
| Single vs multiple roles per user | 📝 schema has `users.role_id`; mockup implies many. If the team adds `user_roles`, `Actor.role` becomes `roles[]` and `hasPermission` unions them |
| Admin sees every module and every row (bypasses employee scoping) | ⏳ extend `canSeeAllEmployees()` |
| Optional: audit log of admin actions, password reset, invitations | ❌ (PDF calls these enhancements) |

### 6.3 Backend checklist

| Step | Status |
|---|---|
| `RoleName` + `ADMIN`; `ADMIN` = all permissions | ⏳ |
| Move / share `users:manage`; add `roles:read`, optional `permissions:write` if permissions become data-driven | ⏳ |
| Seed first admin from env (`SEED_ADMIN_USERNAME/PASSWORD`) | ⏳ |
| Smoke: admin CRUD across modules, self-role-change blocked | ⏳ |

---

## 7. Cross-phase deliverables

| Item | Status | Notes |
|---|---|---|
| Frontend shell + auth + typed API client (unblocks every phase's UI) | ✅ | FE-1…FE-6 verified |
| Phase 1–2 screens (§2.7) | ✅ | combined P1/P2 gate passed |
| vitest rule tests (backend) | ✅ | 68/68 tests in 4 files |
| OpenAPI / Postman collection | ❌ | |
| `package.json` scripts aligned with README | ✅ | Prisma/typecheck/test/smoke/build scripts verified |
| Deployment story (Docker for API + MySQL, Vercel or Node host for Next.js) | ❌ | |
| Representative dataset incl. payroll (PDF deliverable 1) | 🟡 HR data seeded; payroll seed ⏳ |
| Demo script — scenario A: employee → contract → schedule → attendance → payrun → payslip PDF; scenario B: leave type → allocation (balance) → request → approval → balance consumed (PDF deliverable 2) | ❌ | scenario B is fully supported by the API today |
| Future roadmap summary (PDF deliverable 3) | ❌ | multi-role users, hours-based leave, biometric source, SSO, audit log |

---

## 8. Open decisions & risks 📝

| # | Item | Impact | Proposed default |
|---|---|---|---|
| 1 | README ↔ `package.json` scripts | ✅ Resolved; documented scripts exist and backend build regenerates Prisma | Keep aligned as scripts change |
| 2 | Prisma pinned to 6.19.3 | ✅ README updated; do **not** upgrade mid-hackathon | Revisit only with a planned migration |
| 3 | `RoleName` enum changes need a migration per phase | Each phase adds a migration; existing rows unaffected | One migration per phase |
| 4 | Single role per user vs mockup multi-role | Affects `users`, JWT payload, permission checks | Keep single role unless the Phase 5 schema adds `user_roles` |
| 5 | Who owns user management now (HR_MANAGER) vs later (ADMIN) | Permission map change in Phase 5 | HR_MANAGER keeps create-EMPLOYEE-login only; ADMIN gets everything |
| 6 | Salary structure link on contract (mockup) vs on payrun (PDF) | Schema shape for Phase 3/4 | Structure chosen on the payrun; optional default on contract |
| 7 | Formula rules ("Python code" in mockup) | Security: never `eval` user input | Small whitelisted expression evaluator over categories/rules/inputs |
| 8 | Bank details for "missing bank account" warning | No table today | Expect `employee_bank_details` in the Phase 3 schema |
| 9 | Time off spanning years is rejected | Payroll unpaid-leave deduction across year boundary edge case | Keep for hackathon |
| 10 | No persistent MySQL on the dev machine | ✅ Ephemeral MySQL 8.4.9 migration/seed/smoke verified | Use `npm run db:ephemeral` or Docker |
| 11 | Next.js 16 builder behavior | P1/P2 Webpack build is green; default Turbopack exits abnormally on this Windows host | Keep `npm run build -- --webpack` as the verified gate and revisit after Next/toolchain updates |
| 12 | Deactivation/role-change token window | Existing access JWTs retain active/role claims until expiry | Backend token-version or per-request user checks are future hardening |

---

## 9. Playbook — when a phase schema arrives

1. **Confirm scope** with the team: role name, which mockup screens, what changes for existing roles.
2. **Translate** the SQL to Prisma using `docs/phase-1-plan.md` §4.1 rules; append models to `prisma/schema.prisma`; extend `RoleName`. Record any deviation in the phase plan doc (§4.3 style).
3. `npx prisma migrate dev --name phase_<n>_<topic>` → commit the migration.
4. **Permissions:** add `<module>:<action>` entries in `src/auth/permissions.ts`; build the role's set as a superset of the role below it (sketch hierarchy). Update `canSeeAllEmployees()` if the role sees all rows.
5. **Modules:** `src/modules/<module>/{router,schema,service}.ts`; register in `src/routes.ts`. Rules in services only; reuse §3 resolvers.
6. **Seed:** add role + representative data behind the existing "only when empty" guard.
7. **Smoke:** extend `scripts/smoke.ts` with happy path, each rule rejection, and 403 checks for the role below.
8. **Docs:** write `docs/phase-<n>-plan.md` (schema, rules, API, screens) and update the status tables **in this file**.
9. **Frontend:** add the role's menu entries and screens; gate by permissions from `GET /auth/me`.
10. **Update memory / README** with new logins and endpoints.

---

## 10. Recommended sequence from here

Each row below is broken into individually implementable steps with files, actions and a verification gate
in **`docs/build-plan.md`** (step ids `P0-*`, `FE-*`, `P1-*` … `P6-*`). Work that file top to bottom; keep
the status tables here in sync as steps land.

| Order | Work | Why now |
|---|---|---|
| 1 | ✅ Package scripts, README alignment and Prisma pin | Complete |
| 2 | ✅ Frontend foundation: shell, auth, API client, shared primitives and attendance widget | Complete |
| 3 | ✅ Phase 1 EMPLOYEE and Phase 2 HR_MANAGER screens | Combined gate passed |
| 4 | ✅ Vitest regression suite and full seeded smoke | 68 unit tests; 57/57 smoke |
| 5 | **Next:** P3-0 schema intake, then Phase 3/4 migration → permissions → structures/rules → payruns/payslips → engine → PDF/email → dashboard | P3–P5 remain blocked on the team schema or an explicit provisional-schema decision |
| 6 | Phase 5 (ADMIN): role, user-management policy, permission matrix | After payroll role/schema work |
| 7 | OpenAPI, deployment, demo script, payroll seed and roadmap | Final deliverables/hardening |
