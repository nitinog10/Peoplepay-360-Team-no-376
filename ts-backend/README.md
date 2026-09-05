# PeoplePay360 API (ts-backend)

Express 5 + TypeScript REST API backed by MySQL 8 through Prisma 6.19.3 (pinned — do not upgrade mid-hackathon).
Phase 1–4 cover **EMPLOYEE**, **HR_MANAGER**, **HR_PAYROLL_USER**, and **HR_PAYROLL_MANAGER**: HR operations, attendance, time off, payroll processing, salary configuration, and payroll reporting.

## Setup

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL and JWT_ACCESS_SECRET
npm run prisma:generate       # generate the Prisma client
npm run prisma:deploy         # apply prisma/migrations to the database
npm run prisma:seed           # roles, departments, leave types, schedules, demo employees
npm run dev                   # http://localhost:8000/api/v1
```

### Database options

| Option | How |
|---|---|
| Existing MySQL 8 | Set `DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/peoplepay360"` (database must exist). |
| Docker | `docker compose up -d` (MySQL 8.4 on 3306, root/root, database `peoplepay360`). |
| No MySQL installed | `npm run db:ephemeral` (`EPHEMERAL_PORT=3307` to pin the port) downloads a MySQL 8.4 binary, migrates, seeds and keeps running. Then start the API with `DATABASE_URL=mysql://root@127.0.0.1:3307/peoplepay360 npm run dev`. Requires the Microsoft Visual C++ 2015-2022 x64 runtime. |

Schema changes: edit `prisma/schema.prisma`, then `npm run prisma:migrate -- --name <change>`.

### Seeded logins

| Username | Password (env) | Role |
|---|---|---|
| `hr.manager` (`SEED_HR_USERNAME`) | `SEED_HR_PASSWORD` | HR_MANAGER |
| `vikram.singh@oxp.com` | `SEED_PAYROLL_PASSWORD` | HR_PAYROLL_USER |
| `maya.shah@oxp.com` | `SEED_PAYROLL_MANAGER_PASSWORD` | HR_PAYROLL_MANAGER |
| any other employee's work email, e.g. `aarav.mehta@oxp.com` | `SEED_EMPLOYEE_PASSWORD` | EMPLOYEE |

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:port/db` (optional `?connection_limit=10`) |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_MINUTES` | Access token signing and lifetime |
| `REFRESH_TOKEN_TTL_DAYS`, `COOKIE_SECURE` | Refresh token lifetime; cookie `Secure` flag |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `DEFAULT_CURRENCY` | Currency stamped on contracts when none is given |
| `APP_TIMEZONE` | IANA zone used to decide which day a punch belongs to and whether it is late |
| `LATE_GRACE_MINUTES` | Grace after scheduled start before a clock-in counts as late |
| `SEED_HR_PASSWORD`, `SEED_EMPLOYEE_PASSWORD`, `SEED_PAYROLL_PASSWORD`, `SEED_PAYROLL_MANAGER_PASSWORD` | Passwords for the seeded role-specific demo accounts |

## Authentication

`POST /api/v1/auth/login` with `{ "username": "<username or work email>", "password": "..." }` returns an
access token (send as `Authorization: Bearer …`) and a rotating refresh token (also set as an httpOnly
cookie scoped to `/api/v1/auth`). `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.

Permissions are defined in `src/auth/permissions.ts`. EMPLOYEE reads are scoped to the caller's
own employee record inside the services.

## Endpoints (`/api/v1`)

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Users (HR) | `GET/POST /users`, `GET/PATCH /users/:id`, `GET /roles` |
| Departments | `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id` |
| Leave types | `GET/POST /leave-types`, `GET/PATCH/DELETE /leave-types/:id` |
| Work schedules | `GET/POST /work-schedules`, `GET/PATCH/DELETE /work-schedules/:id` |
| Employees | `GET /employees/me`, `GET /employees/me/summary`, `GET /employees/me/schedule`, `GET/POST /employees`, `GET/PATCH/DELETE /employees/:id`, `GET /employees/:id/summary`, `POST /employees/:id/terminate`, `GET /employees/:id/contracts`, `GET/POST /employees/:id/schedule-assignments`, `PATCH/DELETE /schedule-assignments/:id` |
| Contracts | `GET/POST /contracts` (`employeeId`, `status`, `contractType`, `activeOn`), `GET/PATCH/DELETE /contracts/:id`, `POST /contracts/:id/terminate` |
| Attendance | `GET /attendance/session`, `POST /attendance/clock-in|clock-out|break-start|break-end`, `GET/POST /attendance/records`, `GET/PATCH/DELETE /attendance/records/:id`, `POST /attendance/records/:id/entries`, `PATCH/DELETE /attendance/entries/:id`, `POST /attendance/mark-absences` |
| Leave balances | `GET /leave-balances/me`, `GET/POST /leave-balances`, `GET/PATCH/DELETE /leave-balances/:id`, `POST /leave-balances/initialize`, `POST /leave-balances/recompute` |
| Time off | `GET/POST /time-off/requests`, `GET/PATCH /time-off/requests/:id`, `POST /time-off/requests/:id/approve|reject|cancel`, `GET /time-off/requests/:id/approval` |
| Salary configuration | `GET/POST /salary-structures`, `GET/PATCH/DELETE /salary-structures/:id`, `POST /salary-structures/:id/reorder-rules`; `GET/POST /salary-rules`, `GET/PATCH/DELETE /salary-rules/:id` |
| Payruns | `GET/POST /payruns`, `GET/DELETE /payruns/:id`, eligibility, warnings, compute, validate, mark-paid, cancel and send-payslips actions |
| Payslips | `GET /payslips`, `GET/DELETE /payslips/:id`, `POST /payslips/:id/recompute`, `GET /payslips/:id/pdf` |
| Payroll dashboard | `GET /dashboard/payroll?from&to&departmentId&contractType` (one live aggregate response) |

List endpoints accept `page`, `pageSize`, `sort`, `order`, `q` plus module filters and return
`{ data, meta: { page, pageSize, total, totalPages } }`. Dates are `YYYY-MM-DD`; instants are ISO-8601.
Errors use `{ error: { code, message, details? } }` with 400 validation, 401/403 auth, 404, 409 conflicts
and 422 business-rule violations.

## Business rules (where they live)

| Rule | Location |
|---|---|
| Weekly hours derived from days × (end − start) | `modules/work-schedules` |
| Schedule assignments never overlap; new open assignment closes the previous one | `modules/employees/service.ts` |
| One ACTIVE contract per employee per period; auto-expiry; `getActiveContract()` | `modules/contracts/service.ts` |
| Punch state machine, worked/break/overtime hours, lateness, missing check-out | `modules/attendance/derive.ts` |
| Day close: ABSENT / ON_LEAVE / WEEK_OFF rows | `modules/attendance/service.ts` |
| Leave duration = working days per schedule; overlap and balance checks; approval updates `used_days` | `modules/time-off/service.ts` |
| Balances: remaining/available derived; yearly initialisation from leave-type defaults; drift recompute | `modules/leave-balances/service.ts` |
| Salary config conflicts, method operands, reference-safe delete/deactivate and atomic reorder | `modules/salary-structures`, `modules/salary-rules` |
| Payroll lifecycle: DRAFT hard-delete, COMPUTED/VALIDATED cancel, PAID immutability | `modules/payruns`, `modules/payslips` |
| Uniform live payroll/attendance/time-off dashboard aggregation | `modules/dashboard/service.ts` |

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | tsx watch / `prisma generate && tsc` / run `dist` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:deploy` / `prisma:seed` | `prisma generate` / `migrate dev` / `migrate deploy` / `db seed` |
| `npm test` / `npm run test:watch` | vitest — unit tests for the pure rules (no database) |
| `npm run db:ephemeral` | Throwaway MySQL: migrate, verify tables, seed and stay up (`EPHEMERAL_PORT` pins the port) |
| `npm run smoke` | End-to-end Phase 1–4 smoke test against a seeded API (`API_URL` defaults to `http://localhost:8000/api/v1`); current verified total: **113/113** |
