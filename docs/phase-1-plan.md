# PeoplePay360 — Phase 1 Implementation Plan

**Scope of Phase 1**

| Role | Capabilities |
|---|---|
| EMPLOYEE | Own details, own leave balances, own attendance records and entries (clock in / out), own time off requests. No HR admin or payroll access. |
| HR_MANAGER | Full CRUD on employees, attendance, contracts, working schedules, leave balances, leave types, departments. Approve / reject time off requests. No payroll. |

Payroll (salary structures, rules, payruns, payslips, dashboard) is **out of scope**. The schema keeps a few nullable hooks for it.

Sources: `PeoplePay360 HR & Payroll.pdf` (extracted to `pp360.txt`), the Excalidraw mockup, and the **team's SQL schema** (section 4), which is the source of truth for tables and columns.

---

## 1. Current state of the repo

| Area | State |
|---|---|
| `ts-backend/` | Express 5 + TypeScript 7 + tsx. One hello-world route. No Prisma, no DB, no auth, no structure. `node_modules` removed from git; needs `npm install`. |
| `frontend/` | Next.js 16.3.4 + React 19.2 + Tailwind 4 boilerplate. `AGENTS.md` requires reading `node_modules/next/dist/docs/` before writing any frontend code. |
| Database | None yet. Target is MySQL 8 via Prisma (`prisma migrate`). |

Everything is built from scratch. No business values are hardcoded: schedules drive expected hours, leave types drive default allocations, balances drive approvals, roles drive access.

---

## 2. Screens from the mockup (Phase 1)

**Navigation:** `HR | Employees ▼ | Contracts ▼ | Attendance | Time Off ▼ | Payroll`
- Employees ▼ → Employees, Contracts, Departments, Working Schedule
- Time Off ▼ → Dashboard, Time offs (Requests), Time off Types, Allocations (mapped to **Leave Balances**)
- Menu items shown depend on the logged-in user's role.

**Login:** work email + password. Accounts are created by HR (no self-registration). After login only permitted modules appear.

**Employees:** Kanban (default) + List + Form. Form header (name, title • department, email | phone), tabs *Work Information* and *Private Information*, smart buttons with counts for Time Off, Contracts, Attendance.

**Contracts:** list (employee, type, start, end, salary, status, active one highlighted) and form. Never two ACTIVE contracts overlapping for one employee.

**Working Schedules:** list (name, days/week, weekly hours) and form with the weekly pattern; weekly hours derived. Assigned to employees with effective dates.

**Attendance:** list of daily records (employee, first clock-in, last clock-out, worked hours, status), filters *Today* / *Employee*; form shows the day's punches and allows HR corrections. Header widget: Clock In if no open session, else Clock Out with elapsed time.

**Time Off Requests:** list (employee, type, start, end, days, status) with inline Approve / Reject for HR; form with reason and decision comments.

**Leave Balances (Allocations menu):** list (employee, type, year, allocated, carried forward, used, remaining).

**Leave Types:** list + form (name, default annual days, description).

---

## 3. Architecture decisions

### Backend (`ts-backend`)
- **Express 5 REST API**, JSON, versioned under `/api/v1`.
- **Prisma → MySQL 8.** Schema authored in `prisma/schema.prisma` mirroring section 4, applied with `prisma migrate dev`, seeded with `prisma db seed`. Prisma major and MySQL adapter confirmed at install time (Prisma 7 needs `prisma.config.ts` + driver adapter).
- **Layered modules:** `src/modules/<module>/{router,controller,service,schema}.ts`. All rules live in services; Prisma is only touched there.
- **Validation:** `zod` per endpoint via `validate()` middleware; DTO types inferred from schemas.
- **Auth:** bcrypt password hashes in `users.password_hash`. Short-lived JWT access token (Bearer) + rotating refresh token stored hashed in a `refresh_tokens` table (the one table added beyond the team schema; see 4.3) and sent as an httpOnly cookie. `last_login_at` updated on login.
- **RBAC:** one role per user via `users.role_id`. A permission map (`module × action → roles`) in `src/auth/permissions.ts` enforced by `authorize(module, action)`. **Row-level scoping:** for EMPLOYEE, services constrain queries to `actor.employeeId` wherever the permission is *own*.
- **Errors:** `AppError` hierarchy → central handler → `{ error: { code, message, details } }`. Prisma unique / FK errors mapped to 409 / 404.
- **Cross-cutting:** `cors` (frontend origin, credentials), `helmet`, `cookie-parser`, `pino-http`, zod-validated env at boot.
- **List conventions:** `?page&pageSize&sort&order&q&<filters>` → `{ data, meta: { page, pageSize, total } }`.
- **Tests:** vitest + supertest on the rules that matter (contract overlap, balance consumption, worked-hours math, scoping).

### Frontend (`frontend`)
- Next.js 16 App Router; read `node_modules/next/dist/docs/` first.
- Route groups `(auth)/login` and `(app)/…` with a role-aware shell and the attendance widget in the header.
- Typed API client with token refresh on 401. Tailwind 4 + shadcn/ui primitives. TanStack Query for data, react-hook-form + zod for forms.

---

## 4. Data model (team schema, translated to MySQL / Prisma)

### 4.1 Translation rules (PostgreSQL → MySQL via Prisma)

| PostgreSQL | MySQL / Prisma |
|---|---|
| `SERIAL PRIMARY KEY` | `Int @id @default(autoincrement())` |
| `TIMESTAMPTZ DEFAULT now()` | `DateTime @default(now())` (`DATETIME(3)`, stored UTC); `updated_at` → `@updatedAt` |
| `CHECK (col IN (...))` | Prisma `enum` → native MySQL `ENUM` |
| `NUMERIC(p,s)` | `Decimal @db.Decimal(p,s)` |
| `TIME` | `DateTime @db.Time(0)` |
| `SMALLINT[]` (`days_of_week`) | **No arrays in MySQL.** Stored as a `JSON` column holding the ISO weekday array (e.g. `[1,2,3,4,5]`), validated by zod. Schedule keeps its single `start_time` / `end_time` as designed. |
| `TEXT` | `String @db.Text` |
| Table/column names | Kept snake_case in MySQL via `@@map` / `@map`; camelCase in Prisma client. |

### 4.2 Tables (as provided, with MySQL adjustments marked ★)

**Reference / lookup**

| Table | Columns | Notes |
|---|---|---|
| `roles` | role_id, role_name `ENUM(EMPLOYEE, HR_MANAGER)` unique | Seeded. Enum extended in later phases (payroll roles, admin). |
| `departments` | department_id, department_name unique, description | |
| `leave_types` | leave_type_id, type_name unique, default_annual_days `Decimal(5,2)`, description | `default_annual_days` seeds yearly balances. Types with 0 (e.g. Unpaid) skip balance checks. |
| `work_schedules` | schedule_id, schedule_name unique, days_of_week `JSON` ★ (ISO 1–7 array), start_time `TIME`, end_time `TIME`, weekly_hours `Decimal(4,2)` (derived), description, created_at | `weekly_hours = days × (end − start)`, recomputed on save. |

**Core people**

| Table | Columns | Notes |
|---|---|---|
| `employees` | employee_id, first_name, last_name, email unique, phone, date_of_birth, address, hire_date, termination_date, department_id FK, job_title, manager_id FK (self), status `ENUM(ACTIVE, INACTIVE, TERMINATED)`, created_at, updated_at | Central hub. |
| `users` | user_id, employee_id FK unique (cascade), username unique, password_hash, role_id FK, is_active, last_login_at, created_at | Login uses `username`; seed sets `username = employees.email` so the mockup's email login works. |
| `refresh_tokens` ★ | token_id, user_id FK (cascade), token_hash unique, expires_at, revoked_at, created_at | Added for auth; not in team schema. |

**Contracts**

| Table | Columns | Notes |
|---|---|---|
| `contracts` | contract_id, employee_id FK (cascade), contract_type `ENUM(PERMANENT, FIXED_TERM, INTERNSHIP, CONTRACTOR)`, start_date, end_date, base_salary `Decimal(12,2)`, currency `CHAR(3)` default from env, status `ENUM(ACTIVE, EXPIRED, TERMINATED)`, document_url, created_by FK employees, created_at, updated_at | "Running" in the mockup = `ACTIVE`. |

**Working schedule assignment**

| Table | Columns | Notes |
|---|---|---|
| `employee_schedule_assignments` | assignment_id, employee_id FK (cascade), schedule_id FK, effective_from, effective_to, created_at, unique (employee_id, effective_from) | Effective-dated; resolves "which schedule applies on date D". |

**Leave**

| Table | Columns | Notes |
|---|---|---|
| `leave_balances` | leave_balance_id, employee_id FK (cascade), leave_type_id FK, year `SMALLINT`, allocated_days, carried_forward_days, used_days (`Decimal(5,2)`), updated_at, unique (employee_id, leave_type_id, year) | `remaining = allocated + carried_forward − used`, computed in the API response, never stored. |
| `time_off_requests` | time_off_request_id, employee_id FK (cascade), leave_type_id FK, start_date, end_date, total_days `Decimal(5,2)`, reason, status `ENUM(PENDING, APPROVED, REJECTED, CANCELLED)`, requested_at, updated_at | `end_date >= start_date` enforced in zod and service (MySQL CHECK optional). `total_days` computed by the service. |
| `time_off_approvals` | approval_id, time_off_request_id FK unique (cascade), reviewed_by FK employees, decision `ENUM(APPROVED, REJECTED)`, comments, decided_at | Written in the same transaction that flips the request status. `reviewed_by` must hold HR_MANAGER. |

**Attendance**

| Table | Columns | Notes |
|---|---|---|
| `attendance_records` | attendance_record_id, employee_id FK (cascade), attendance_date, status `ENUM(PRESENT, ABSENT, HALF_DAY, ON_LEAVE, HOLIDAY, WEEK_OFF)`, notes, created_at, updated_at, unique (employee_id, attendance_date) | Daily summary row. |
| `attendance_entries` | attendance_entry_id, attendance_record_id FK (cascade), entry_type `ENUM(CLOCK_IN, CLOCK_OUT, BREAK_START, BREAK_END)`, entry_time, source `ENUM(MANUAL, BIOMETRIC, MOBILE_APP, WEB)` default MANUAL, created_at | Raw punches. Worked hours derived from pairs. Widget punches use `WEB`; HR corrections use `MANUAL`. |

**Indexes** (as provided): employees(department_id), employees(manager_id), attendance_records(employee_id, attendance_date), attendance_entries(attendance_record_id), time_off_requests(employee_id), leave_balances(employee_id, year), contracts(employee_id), employee_schedule_assignments(employee_id). Added ★: contracts(employee_id, status), time_off_requests(status), refresh_tokens(user_id).

### 4.3 Deviations from the team schema (all forced or additive)
1. `work_schedules.days_of_week` → `JSON` column (MySQL has no arrays).
2. `refresh_tokens` table added for session handling.
3. CHECK constraints become Prisma enums; range checks (`end_date >= start_date`) enforced in validation and services.
4. `contracts.currency` default comes from `DEFAULT_CURRENCY` in env instead of a hardcoded `'USD'`.
5. Three extra indexes.

Decision (2026-09-05): the schema is the source of truth; the mockup is inspiration only. Section 9 items are **not** implemented unless they fix a schema error.

---

## 5. Business rules (services)

**Working schedules**
- `weekly_hours = |days_of_week| × (end_time − start_time)` recomputed on every save; weekdays unique and within 1–7; `end_time > start_time`.
- Assignments for one employee must not overlap (`effective_from ≤ D < effective_to ?? ∞`). Resolver: `getScheduleFor(employeeId, date)`.
- A day is a **working day** if the resolved schedule has a row for that weekday; otherwise `WEEK_OFF`.

**Contracts**
- Lifecycle `ACTIVE → EXPIRED | TERMINATED`. Creating or editing an ACTIVE contract is rejected if another ACTIVE contract of the same employee overlaps its date range.
- Contracts whose `end_date` has passed are surfaced as `EXPIRED` (read-time check plus an idempotent `expireContracts()` service).
- `created_by` set from the acting HR manager's employee_id.
- `getActiveContract(employeeId, date)` is the single resolver payroll reuses later.

**Attendance**
- Clock-in: get-or-create today's `attendance_records` row (status PRESENT), reject if the last entry is an open `CLOCK_IN`; insert `CLOCK_IN` with source `WEB`. Clock-out: requires an open session; inserts `CLOCK_OUT`. Break start/end follow the same pairing rule.
- Derived per record (computed in the service, returned in the API, not stored): `worked_hours = Σ(clock_out − clock_in) − Σ(break_end − break_start)`, `expected_hours` from the schedule day, `overtime = max(0, worked − expected)`, `is_late = first CLOCK_IN > start_time + grace` (grace from env, default 0), `missing_checkout` when the day ends with an open CLOCK_IN.
- Employees can create punches (clock in/out) and read their own records. Editing or deleting punches and records is HR only; HR edits set `source = MANUAL`.
- `markAbsences(date)`: for each ACTIVE employee, if `date` is a working day with no record → `ABSENT`; approved leave covering the date → `ON_LEAVE`; non-working day → `WEEK_OFF`. Idempotent, HR endpoint, cron-able later.

**Leave balances**
- `remaining = allocated + carried_forward − used`; `pending` = Σ `total_days` of PENDING requests for that type/year; `available = remaining − pending`. All returned by the API.
- `initializeYear(year)`: creates missing `leave_balances` rows for ACTIVE employees from `leave_types.default_annual_days` (optionally carrying forward last year's remaining). HR-triggered, never hardcoded.
- `used_days` is updated inside the approval / cancellation transaction; a recompute endpoint verifies it against APPROVED requests.

**Time off requests**
- `total_days` = number of working days between start and end per the employee's schedule (non-working days do not consume balance). A request must not overlap another PENDING or APPROVED request of the same employee. Requests may not span two calendar years (Phase 1 simplification).
- If the leave type has a balance row (or `default_annual_days > 0`): on submit, `available ≥ total_days` else 400 with the shortfall.
- Approve / reject (HR_MANAGER only): re-check balance, insert `time_off_approvals`, set request status, on approve `used_days += total_days`. One decision per request (unique FK).
- Cancel: owner while PENDING; HR while PENDING or APPROVED (APPROVED → `used_days −= total_days`).

**Employees & users**
- Email unique; manager cannot be self; setting TERMINATED sets `termination_date` and deactivates the linked user.
- HR_MANAGER creates users (linked to an employee, one role). Users cannot change their own role. Seed provides the first HR_MANAGER account.
- Smart-button counts (contracts, attendance records, requests) from one aggregate query.

---

## 6. API surface (`/api/v1`)

Legend: **E** = EMPLOYEE (own rows only), **H** = HR_MANAGER.

| Module | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | all |
| Users | `GET/POST /users`, `GET/PATCH /users/:id`, `GET /roles` | H |
| Departments | `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id` | read E,H · write H |
| Work schedules | `GET/POST /work-schedules`, `GET/PATCH/DELETE /work-schedules/:id` | read E,H · write H |
| Schedule assignments | `GET/POST /employees/:id/schedule-assignments`, `PATCH/DELETE /schedule-assignments/:id`, `GET /employees/me/schedule` | E own read · H |
| Employees | `GET /employees` (q, department, status, manager), `POST /employees`, `GET/PATCH/DELETE /employees/:id`, `GET /employees/:id/summary`, `GET /employees/me` | E `me` · H all |
| Contracts | `GET /contracts` (employeeId, status), `POST /contracts`, `GET/PATCH/DELETE /contracts/:id`, `POST /contracts/:id/terminate`, `GET /employees/:id/contracts` | E own read · H |
| Attendance | `GET /attendance/records` (date, from, to, employeeId, status), `POST /attendance/records`, `GET/PATCH/DELETE /attendance/records/:id`, `POST /attendance/records/:id/entries`, `PATCH/DELETE /attendance/entries/:id`, `POST /attendance/clock-in`, `POST /attendance/clock-out`, `POST /attendance/break-start`, `POST /attendance/break-end`, `GET /attendance/session`, `POST /attendance/mark-absences` | E: own read, clock/break, session · H: all |
| Leave types | `GET/POST /leave-types`, `GET/PATCH/DELETE /leave-types/:id` | read E,H · write H |
| Leave balances | `GET /leave-balances` (employeeId, year, leaveTypeId), `POST /leave-balances`, `PATCH/DELETE /leave-balances/:id`, `POST /leave-balances/initialize`, `POST /leave-balances/recompute`, `GET /leave-balances/me` | E `me` · H |
| Time off requests | `GET /time-off/requests` (status, employeeId, from, to), `POST /time-off/requests`, `GET/PATCH /time-off/requests/:id`, `POST …/:id/approve`, `POST …/:id/reject`, `POST …/:id/cancel`, `GET /time-off/requests/:id/approval` | E: create/read/edit-while-pending/cancel own · H: all + decisions |

---

## 7. Frontend screens (Phase 1)

| Route | Screen | Roles |
|---|---|---|
| `/login` | Login | all |
| `/` | EMPLOYEE → *My Space* (details, balances, attendance, requests); HR → Employees | all |
| `/employees`, `/employees/[id]` | Kanban / List; form with tabs + smart buttons | H, E (own) |
| `/departments` | List + form | H |
| `/work-schedules`, `/work-schedules/[id]` | List; form with per-day rows and derived weekly hours; assignment history | H |
| `/contracts`, `/contracts/[id]` | List highlighting ACTIVE; form | H, E (own read) |
| `/attendance`, `/attendance/[id]` | Daily records list; day form with punches and HR corrections | H, E (own) |
| Header widget | Clock In / Out with elapsed time and status dot | all |
| `/time-off/requests`, `/time-off/requests/[id]` | List with inline Approve / Reject; form with decision | H, E (own) |
| `/time-off/balances` (nav label "Allocations") | Balances list; HR edit; initialize-year action | H, E (own read) |
| `/time-off/types` | List + form | H |
| `/time-off` | Dashboard: my balances, pending approvals (HR) | all |
| `/users` | Create accounts, link employee, set role | H |

---

## 8. Implementation order

**Status (2026-09-05):** milestones 0–5 are built and verified end to end against MySQL 8.4 (migration
applied, seed loaded, 57/57 smoke checks passing via `ts-backend/scripts/smoke.ts`). Milestone 6 has the
seed and smoke test; vitest unit tests and OpenAPI are still open. Milestone 7 (frontend) not started.

| # | Milestone | Deliverable |
|---|---|---|
| 0 | Foundation | Prisma + MySQL wired (`.env`, optional `docker-compose.yml`), app skeleton, health route, module layout, first migration from section 4. |
| 1 | Auth + RBAC | Users / roles / refresh tokens, login / refresh / logout / me, `authorize()` + own-row scoping, seed roles + first HR manager, users endpoints. |
| 2 | Org master data | Departments, work schedules + days (derived hours), employees CRUD, `employees/me`, summary counts, schedule assignments. |
| 3 | Contracts | CRUD, overlap guard, expiry, terminate, `getActiveContract`. |
| 4 | Attendance | Records + entries, clock/break endpoints, derived worked / overtime / late, `mark-absences`, HR corrections. |
| 5 | Leave | Leave types, balances (+ initialize / recompute), requests (submit / approve / reject / cancel), approvals table, working-day duration, overlap and balance guards. |
| 6 | Seed + tests + docs | Representative dataset, vitest rule tests, request collection / OpenAPI. |
| 7 | Frontend | Shell + auth → Employees → Departments → Work Schedules → Contracts → Attendance + widget → Time Off → My Space → Users. |

Backend milestones 0–5 each end with the module exercised over HTTP. Frontend starts after milestone 2.

---

## 9. Gaps between the team schema and the mockup / PDF (reference only — not built in Phase 1)

| # | Gap | Recommendation |
|---|---|---|
| 1 | Mockup's Time Off Type has unit (days/hours), requires-allocation, approval-by, colour, active. Schema has name, default days, description. | Add `requires_balance BOOLEAN` and `is_active BOOLEAN` to `leave_types`. Skip hours-unit and approval-by in Phase 1. |
| 2 | PDF says allocations need approval before use. Schema has HR directly setting `leave_balances`. | Accept: HR creating the balance is the approval. Note in demo script. |
| 3 | Mockup contract shows reference number (`CON/2026/0042`), job position, department, working schedule, salary structure. | Add `contract_reference VARCHAR unique` generated from a `sequences` table; leave the rest to the schedule assignment and a later `salary_structure_id`. |
| 4 | Header says EMPLOYEE has CRUD on own attendance; PDF restricts corrections to authorized users. | Employee = create punches + read; edit / delete = HR only. |
| 5 | Roles enum has two values; mockup lists five and multi-role users. | Keep single role per user; extend the enum when payroll roles arrive. |
| 6 | Login by `username` vs mockup's work email. | Seed `username = email`; login accepts either. |
| 7 | No LATE status or manual-edit audit on attendance. | `is_late` and `missing_checkout` derived on read; `source = MANUAL` marks HR edits. Optionally add `edited_by` later. |
| 8 | Requests spanning a calendar year touch two balance rows. | Reject in Phase 1 with a clear message. |
| 9 | `used_days` stored while remaining is derived. | Keep; maintain transactionally; `recompute` endpoint as safety net. |
