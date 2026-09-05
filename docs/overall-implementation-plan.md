# PeoplePay360 — Overall Implementation Plan & Status

**Last audited:** 2026-09-06 (combined Phase 1–5 backend build/typecheck, zero-warning frontend checks, 82 tests, two migrations, repeatable seed, 145/145 smoke, and 25/25-page Webpack build verified).
**Companion docs:** `docs/build-plan.md` (**the executable step-by-step queue derived from this file — start there**), `docs/phase-1-plan.md` (detailed schema, rules and API for Phases 1–2), `docs/phase-3-plan.md` (implemented provisional payroll schema/lifecycle source of truth for Phases 3–4), `pp360.txt` (problem statement), `HRMS OXP - 24 hours.excalidraw` (mockup), `ts-backend/README.md` (run instructions).

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

The sketch numbers the roles ① → ⑤ and shows the access hierarchy on the back page. **Each phase delivers one role.** Phases 1 and 2 share `docs/phase-1-plan.md`; Phase 3 is implemented from the provisional contract in `docs/phase-3-plan.md`.

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
| 3 | ③ `HR_PAYROLL_USER` | 📝 provisional implementation; authoritative team SQL pending reconciliation | ✅ implemented + included in 82 tests and 113/113 smoke | ✅ P3-9…P3-12; combined production gate passed | `docs/phase-3-plan.md` |
| 4 | ④ `HR_PAYROLL_MANAGER` | 📝 provisional implementation; authoritative team SQL pending reconciliation | ✅ P4-1…P4-4/P4-7 implemented and verified | ✅ P4-5/P4-6; dashboard + editors emitted by production build | `docs/build-plan.md` § Phase 4 |
| 5 | ⑤ `ADMIN` | 📝 no separate Phase 5 schema supplied; released on the existing single-role model | ✅ P5-1/P5-2/P5-5 implemented and verified | ✅ P5-3/P5-4; `/users` + `/admin/roles`, 25/25-page production gate | `docs/build-plan.md` § Phase 5 |

Cross-phase work (frontend shell, tests, docs, demo) is tracked in §7. Open decisions are in §8. The "schema arrives" playbook is §9.

---

## 1. Repository snapshot (verified 2026-09-06)

| Area | State | Evidence |
|---|---|---|
| `ts-backend/` app code | ✅ Express 5 + TypeScript 7, layered `router/schema/service` modules including payroll configuration, dashboard, and ADMIN user/role policy | `src/routes.ts`, `src/modules/*` |
| Typecheck | ✅ backend `npm run typecheck`; frontend `npx next typegen` + `npx tsc --noEmit` | combined Phase 1–5 gate |
| Prisma schema + migrations | ✅ 20 application tables, 13 enums, initial + isolated provisional payroll migration | `prisma/schema.prisma`, `prisma/migrations/`; fresh MySQL exposed 21 tables including `_prisma_migrations` |
| Prisma version | ✅ **6.19.3 pinned**; README and scripts aligned | `package.json`, `ts-backend/README.md` |
| Seed | ✅ HR dataset, all role rows, payroll-user, payroll-manager and dedicated ADMIN logins, Regular Salary + 8 rules, bank-warning data and computed prior-month payrun; immediate second run idempotent | fresh ephemeral MySQL seed ×2 |
| Smoke test | ✅ **145/145** Phase 1–5 checks against ephemeral MySQL 8.4.9 | `scripts/smoke.ts` |
| Unit tests (vitest) | ✅ **82/82 tests in 5 files** | `npm test` |
| OpenAPI / request collection | ❌ | — |
| npm scripts | ✅ Prisma, typecheck, test, smoke, ephemeral DB and generated-client build scripts aligned | `ts-backend/package.json`, README |
| Local DB | ✅ ephemeral MySQL 8.4.9 applied both migrations, repeated the seed and passed 145/145 smoke; no persistent local MySQL/Docker required | `scripts/ephemeral-db.ts` |
| `frontend/` | ✅ Next.js 16.3.4 Phase 1–5 application; Webpack production build, typecheck and zero-warning lint green; **25/25** static generation including `/admin/roles` | `frontend/app`, `frontend/components`, `frontend/lib` |
| Git | Uncommitted Phase 1–5 implementation and planning updates present; no commit was requested | `git status --short` |

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
| Permission catalogue (**27 permissions**) + explicit `ROLE_PERMISSIONS` sets | ✅ `EMPLOYEE`, frozen non-payroll `HR_MANAGER`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, and all-permission `ADMIN`; `roles:read` is ADMIN-only |
| `authenticate` + `authorize(...permissions)` middleware | ✅ |
| Row-level scoping for EMPLOYEE via `scopeToEmployee()` / `requireEmployeeScope()` | ✅ smoke `employee sees only self`, `employee cannot read another employee`, `employee sees only own contracts`, `employee cannot request for someone else`; ADMIN unrestricted-scope checks pass |
| Users cannot change own role / deactivate self; deactivation & password change revoke refresh sessions | ✅ smoke `HR cannot change own role`, `ADMIN cannot change own role`, `ADMIN cannot deactivate own account` |
| Role enum contains `EMPLOYEE`, `HR_MANAGER`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` | ✅ all five are assignable by ADMIN; non-ADMIN account managers receive and may assign EMPLOYEE only |

### 2.3 Data model (14 tables, all migrated ✅)

| Table | Status | Notes |
|---|---|---|
| `roles` | ✅ | enum and lookup rows contain all five released role literals |
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
| Users / roles | `GET/POST /users`, `GET/PATCH /users/:id`, `GET /roles`, `GET /roles/permissions` | ✅ ADMIN all-five catalogue/read-only matrix; non-ADMIN managers limited to EMPLOYEE; escalation/privileged-target guards covered by smoke |
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
| Seeded logins: `employee` (EMPLOYEE), `hr.manager` (HR_MANAGER), `hr.payroll.user` (HR_PAYROLL_USER), `hr.payroll.manager` (HR_PAYROLL_MANAGER), and `admin` (ADMIN); all use explicit per-role env pairs | ✅ |
| Smoke test walking every released module and rule | ✅ **145/145** Phase 1–5 `scripts/smoke.ts` |
| **vitest unit tests** on attendance, date, schedule, permission and safe payroll-engine rules | ✅ **82/82 tests in 5 files** |
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
| Contract reference `CON/2026/0042`, job position, salary structure on contract | Reference number optional later; Phase 3 provisionally chose structure-on-payrun and snapshots it there. Reconcile if authoritative SQL later adds a contract default. |
| Five roles / multi-role users | All five roles are released. The current Phase 5 design intentionally retains one `users.role_id` per user; multi-role accounts remain future roadmap work rather than a release blocker. |
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

## 4. Phase 3 — HR_PAYROLL_USER (payruns & payslips) ✅ implemented and verified; schema provisional

**Access (PDF §3 + sketch):** everything HR_MANAGER has, **plus Create / Read / Update** on Payruns and Payslips, **read-only** Salary Structures and Salary Rules. No payroll hard-delete, no config edits. The implementation contract is `docs/phase-3-plan.md`; authoritative Phase 3/4 team SQL is still pending reconciliation.

### 4.1 Mockup screens (section 4 "Payroll — Payrun & Payslips")

| Screen | Key content | Status |
|---|---|---|
| Payroll ▼ menu: Payruns, Payslips, Salary Structures, Salary Rules | permission-filtered; no Phase 3 dashboard | ✅ |
| Payruns list | name, structure, period, status, #payslips; URL-backed search/filter | ✅ `/payroll/payruns` |
| **New Pay Run wizard — Step 1** | structure/period/contract type; Continue performs eligibility GET only | ✅ |
| **Step 2** employee selection | flagged/selectable employees; sole POST includes selected IDs only | ✅ |
| Payrun detail | COMPUTE → VALIDATE → MARK PAID → SEND, cancel, payslips, hard/soft warnings | ✅ `/payroll/payruns/[id]` |
| Payslips list | employee, structure, payrun, period, status, worked days, amounts | ✅ `/payroll/payslips` |
| Payslip detail | identification, input snapshots, ordered Salary Computation, authoritative totals, authenticated PDF | ✅ `/payroll/payslips/[id]` |
| Salary Structures / Rules | read-only list/detail with `editable={false}` | ✅ `/payroll/structures`, `/payroll/structures/[id]`, `/payroll/rules` |
| Payroll Dashboard | delivered in Phase 4 with uniform filters and live aggregates | ✅ `/payroll/dashboard` |

### 4.2 Business rules (from PDF §4 B5–B8, mockup notes)

| Rule | Status |
|---|---|
| Payrun lifecycle `DRAFT → COMPUTED → VALIDATED → PAID` (+ `CANCELLED`); transitions guarded; PAID/CANCELLED terminal | ✅ 84/84 smoke lifecycle guards |
| Wizard writes only on Create and includes only selected employees | ✅ selected-only create smoke |
| Eligibility uses ACTIVE employees and the period-end contract; overlapping non-cancelled payslips remain visible, flagged and nonselectable | ✅ |
| Rules execute in sequence and snapshot lines/totals using decimal half-up two-decimal rounding | ✅ engine tests + smoke |
| Worked days/hours reuse schedule and attendance derivation; unpaid days use approved untracked leave types | ✅ |
| Hard/soft warnings cover contract/salary/currency/rule/duplicate/computation/net and bank data conditions | ✅ warning split smoke |
| Validation blocks hard warnings; Mark Paid stamps immutable history | ✅ |
| Payslip PDF is generated server-side with PDFKit and streamed under authenticated scope | ✅ `%PDF` smoke |
| Send Payslips uses Nodemailer SMTP when configured and deterministic offline JSON transport otherwise | ✅ per-recipient smoke |
| Recompute is allowed only while DRAFT/COMPUTED | ✅ PAID rejection smoke |

### 4.3 Implemented provisional schema

The isolated `20260905010000_phase_3_payroll` migration implements six application tables: `salary_structures`, direct one-to-many `salary_rules.salary_structure_id`, `employee_bank_details`, `payruns`, `payslips`, and `payslip_lines`. It adds `SalaryRuleCategory`, `SalaryRuleMethod`, `SalaryRuleBase`, and `PayrunStatus`, plus all remaining `RoleName` literals. Payruns own the selected structure; payslips and lines snapshot calculation history; payslip status is derived from the payrun. Full columns, relations, indexes, delete behavior, and reconciliation points are in `docs/phase-3-plan.md` §3 and §12.

This is implemented—not a placeholder—but remains **provisional**. When authoritative team SQL arrives, compare every table/column/constraint and reconcile through a later migration without erasing consumed migration history.

### 4.4 Backend checklist

| Step | Status |
|---|---|
| Payroll migration, all role enum values, idempotent role rows | ✅ fresh MySQL 8.4.9 applied both migrations; 21 exposed tables |
| Four payroll permissions and released `HR_PAYROLL_USER` HR superset | ✅ unit tests + live lower-role 403s |
| Read modules for structures/rules; lifecycle modules for payruns/payslips | ✅ typecheck + 84/84 smoke |
| Safe decimal rule engine with bounded parser and no `eval` | ✅ 81/81 tests |
| Scoped PDF + Nodemailer SMTP/offline JSON services | ✅ live PDF/send smoke |
| Regular Salary, eight rules, bank-warning data, payroll login, computed prior-month payrun | ✅ seed passed twice idempotently |
| Full P1/P2/P3 regression and role boundary checks | ✅ 84/84 smoke |

### 4.5 Frontend checklist ✅

All seven Phase 3 routes in §4.1 are implemented with permission-driven navigation/actions, Promise-based Next.js 16 dynamic params, Suspense around URL-backed lists, TanStack Query, and authenticated refresh-aware blob downloads. `npx tsc --noEmit` and `npm run lint` passed; the Next.js 16.3.4 Webpack production build completed 23/23 static page generation and emitted every payroll route. No browser-only manual click-through was recorded; matching workflows are covered by live API smoke.

---

## 5. Phase 4 — HR_PAYROLL_MANAGER (payroll configuration + dashboard) ✅ implemented and verified; schema provisional

**Access (sketch ④):** the complete `HR_PAYROLL_USER` permission set plus `salary-config:write`, `payruns:delete`, and `payslips:delete`. Configuration writes and DRAFT hard-delete are manager-only; payroll reads and normal lifecycle writes remain inherited.

> Schema note: Phase 4 extends the provisional Phase 3 direct structure-to-rule model. Authoritative Phase 3/4 team SQL is still pending and must be reconciled through a later migration if it differs.

### 5.1 Mockup screens (section 5 "Payroll Configuration" and 6 "Payroll Dashboard")

| Screen | Key content | Status |
|---|---|---|
| Salary Structures list | search/filter, name, ordered rule count, active state, create/edit/delete | ✅ `/payroll/structures` |
| Salary Structure detail/editor | details, ordered rules, up/down atomic reorder, add/edit/delete/deactivate | ✅ `/payroll/structures/[id]` |
| Salary Rules list | dynamic filters, name, code, category, structure, sequence, edit/delete | ✅ `/payroll/rules` |
| Salary Rule form | category, sequence, Fixed / Percentage with base / Formula operands, active state and formula hints | ✅ permission-gated dialogs |
| Payroll Dashboard | five KPIs, department cost and monthly trend charts, linked alerts, attendance/time-off summaries, department breakdown, and uniform period/department/contract-type filters | ✅ `/payroll/dashboard` |
| Payrun/payslip DRAFT deletion | manager-only affordances; later states expose only valid lifecycle actions | ✅ existing detail routes extended |

### 5.2 Business rules

| Rule | Status |
|---|---|
| Structures are containers; rule code is globally unique and sequence is unique within a structure | ✅ explicit 409 conflicts; two-phase transactional reorder avoids intermediate collisions |
| Computation methods validate only their applicable operands: fixed amount, percentage/base, or bounded formula | ✅ API schemas and forms are method-aware |
| Editing a structure/rule never mutates historic payslips; `payslip_lines` retain snapshots | ✅ paid-payslip before/after smoke assertion |
| Referenced structures/rules return 422 with counts and `canDeactivate`; unreferenced records can be deleted | ✅ config delete smoke coverage |
| Payrun/payslip hard-delete is DRAFT-only; COMPUTED/VALIDATED cancel preserves history; PAID/CANCELLED stay immutable | ✅ lifecycle boundary smoke coverage |
| Dashboard aggregates live data only; one employee cohort and date range apply filters uniformly | ✅ direct-query audit + one-response smoke assertion |

### 5.3 Backend checklist

| Step | Status |
|---|---|
| Release `HR_PAYROLL_MANAGER`; add `salary-config:write`, `payruns:delete`, `payslips:delete`; seed Maya login | ✅ `/auth/me` full 26-permission catalogue; role assignable while ADMIN stays withheld |
| Structure/rule POST/PATCH/DELETE and atomic rule reorder with conflict/reference safeguards | ✅ typecheck + smoke |
| DRAFT payrun/payslip deletion and later-state cancellation/history preservation | ✅ typecheck + smoke |
| `GET /dashboard/payroll?from&to&departmentId&contractType` live aggregate | ✅ registered, typed and smoke-tested |
| Boundary and historic-immutability smoke coverage | ✅ **113/113** full-suite checks |
| Independent dashboard reconciliation | ✅ API values matched direct Prisma values: 4 payslips, 394337.50 net trend, 98584.38 average, 4 approved days |

### 5.4 Frontend checklist ✅

| Step | Status |
|---|---|
| Permission-derived structure/rule editors preserve `HR_PAYROLL_USER` read-only behavior | ✅ |
| Conflict messages, method-specific controls, reorder, delete/deactivate fallback and historic-data warning | ✅ |
| Dashboard uses one exact-pinned chart library (`recharts@3.10.1`) and one aggregate request | ✅ |
| URL-backed filters update all dashboard widgets; KPIs/alerts link to explanatory records/lists | ✅ |
| Next type generation, TypeScript, zero-warning ESLint and Webpack production build | ✅ 24/24 static pages; `/payroll/dashboard` emitted |

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
| Release existing `ADMIN` enum/role row with all permissions | ⏳ |
| Move / share `users:manage`; add `roles:read`, optional `permissions:write` if permissions become data-driven | ⏳ |
| Seed first admin from env (`SEED_ADMIN_USERNAME/PASSWORD`) | ⏳ |
| Smoke: admin CRUD across modules, self-role-change blocked | ⏳ |

---

## 7. Cross-phase deliverables

| Item | Status | Notes |
|---|---|---|
| Frontend shell + auth + typed API client (unblocks every phase's UI) | ✅ | FE-1…FE-6 verified |
| Phase 1–2 screens (§2.7) | ✅ | combined P1/P2 gate passed |
| Phase 3 payroll backend + screens (§4) | ✅ | included in 82 tests, 113/113 smoke and production build |
| Phase 4 payroll configuration + dashboard (§5) | ✅ | direct-query audit, 113/113 smoke, 24/24-page production build |
| vitest rule tests (backend) | ✅ | **82/82 tests in 5 files** |
| OpenAPI / Postman collection | ❌ | |
| `package.json` scripts aligned with README | ✅ | Prisma/typecheck/test/smoke/build scripts verified |
| Deployment story (Docker for API + MySQL, Vercel or Node host for Next.js) | ❌ | |
| Representative dataset incl. payroll (PDF deliverable 1) | 🟡 | Phase 3 payroll seed is present; final P6-3 expansion (including broader/two-payrun demo data) remains pending |
| Demo script — scenario A: employee → contract → schedule → attendance → payrun → payslip PDF; scenario B: leave type → allocation (balance) → request → approval → balance consumed (PDF deliverable 2) | ❌ | scenario B is fully supported by the API today |
| Future roadmap summary (PDF deliverable 3) | ❌ | multi-role users, hours-based leave, biometric source, SSO, audit log |

---

## 8. Open decisions & risks 📝

| # | Item | Impact | Proposed default |
|---|---|---|---|
| 1 | README ↔ `package.json` scripts | ✅ Resolved; documented scripts exist and backend build regenerates Prisma | Keep aligned as scripts change |
| 2 | Prisma pinned to 6.19.3 | ✅ README updated; do **not** upgrade mid-hackathon | Revisit only with a planned migration |
| 3 | `RoleName` enum changes | ✅ All remaining literals landed together in the isolated Phase 3 migration; permissions still control release | Reconcile only if authoritative SQL requires a different enum strategy |
| 4 | Single role per user vs mockup multi-role | Affects `users`, JWT payload, permission checks | Keep single role unless the Phase 5 schema adds `user_roles` |
| 5 | Who owns user management now (HR_MANAGER) vs later (ADMIN) | Permission map change in Phase 5 | HR_MANAGER keeps current released-role management; ADMIN policy lands in Phase 5 |
| 6 | Salary structure link on contract vs payrun | 📝 Provisionally resolved to structure-on-payrun; authoritative SQL may differ | Preserve the run snapshot and define precedence if a contract default arrives |
| 7 | Formula rules ("Python code" in mockup) | ✅ Implemented as a bounded deterministic parser; arbitrary code is rejected | Never use `eval`; version syntax before extending it |
| 8 | Bank details for warning generation | 📝 Provisional `employee_bank_details` exists with warning seed data; production masking/encryption policy remains | Reconcile fields/security with authoritative SQL before production |
| 9 | Time off spanning years is rejected | Payroll unpaid-leave deduction across year boundary edge case | Keep for hackathon |
| 10 | No persistent MySQL on the dev machine | ✅ Ephemeral MySQL 8.4.9 applied both migrations, repeated the seed, and passed 113/113 smoke | Use `npm run db:ephemeral` or Docker |
| 11 | Next.js 16 builder behavior | Phase 1–4 Webpack build is green with 24/24 static pages; the prior Turbopack attempt exited `-1` without diagnostics on this Windows host | Keep `npm run build -- --webpack` as the verified gate and revisit after toolchain updates |
| 12 | Deactivation/role-change token window | Existing access JWTs retain active/role claims until expiry | Backend token-version or per-request user checks are future hardening |
| 13 | Dependency audit | `npm install` reported 5 vulnerabilities (1 moderate, 4 high) | Review with compatibility testing; do not run `npm audit fix --force` unreviewed |

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
| 4 | ✅ Current regression suite and seeded smoke | 82/82 unit tests; 113/113 smoke |
| 5 | ✅ Phase 3 HR_PAYROLL_USER: provisional migration, permissions, engine, payruns/payslips, PDF/mail and frontend | Combined Phase 1–3 foundation remains green; authoritative SQL reconciliation remains a risk |
| 6 | ✅ Phase 4 HR_PAYROLL_MANAGER: config CRUD, lifecycle delete/cancel, live dashboard and frontend | 113/113 smoke, direct dashboard reconciliation and production build passed |
| 7 | **Next: P5-1**, then Phase 5 ADMIN role, user-management policy and permission matrix | Payroll-manager work is complete; ADMIN remains unreleased |
| 8 | OpenAPI, deployment, demo script, representative-data expansion and roadmap | Final deliverables/hardening |
