# PeoplePay360 Backend API

Express 5 and TypeScript REST API for PeoplePay360, backed by MySQL 8 through Prisma.

The API supports all five application roles: `EMPLOYEE`, `HR_MANAGER`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, and `ADMIN`.

For complete full-stack setup, including the Next.js application, see the [root README](../README.md). For frontend-only instructions, see [`frontend/README.md`](../frontend/README.md).

## Capabilities

- JWT access tokens and rotating refresh tokens
- Permission-based API authorization
- Employee row-level scoping
- Employees, departments, contracts, and work schedules
- Attendance punches, corrections, and derived totals
- Leave types, balances, time-off requests, and approvals
- Salary structures/rules, payruns, payslips, PDFs, and payroll dashboard
- User management and a read-only role-permission matrix
- Representative demo seed, pure-rule tests, and end-to-end smoke coverage

## Technology

- Node.js and Express 5
- TypeScript
- Prisma Client/CLI 6.19.3 as resolved by the lockfile
- MySQL 8
- Zod environment/request validation
- bcrypt password hashing
- JSON Web Tokens and opaque rotating refresh tokens
- Vitest
- Nodemailer and PDFKit

## Prerequisites

- Node.js 24.x recommended
- npm
- One database option:
  - MySQL 8.x already installed
  - Docker Desktop/Engine with Compose
  - Included ephemeral MySQL 8.4 helper

The ephemeral option on Windows requires the Microsoft Visual C++ 2015-2022 x64 Redistributable. Its first run downloads a MySQL binary.

## Installation

Run all commands in this document from `ts-backend` unless stated otherwise.

### 1. Install dependencies

```powershell
npm ci
```

Use `npm ci` for reproducible installation from `package-lock.json`.

### 2. Create the environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash/zsh:

```bash
cp .env.example .env
```

### 3. Generate Prisma Client

```powershell
npm run prisma:generate
```

The generated client is written under `src/generated/prisma` and is ignored by Git. Generate it after a fresh clone and after Prisma schema/client changes.

## Environment configuration

Generate a random development JWT secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste it into `JWT_ACCESS_SECRET` in `.env`.

### Complete local `.env` example

```dotenv
# Server
NODE_ENV=development
PORT=8000
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000

# MySQL - change this for the selected database option
DATABASE_URL="mysql://root:root@127.0.0.1:3306/peoplepay360"

# Authentication
JWT_ACCESS_SECRET=replace-with-a-random-value-of-at-least-16-characters
JWT_ACCESS_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
COOKIE_SECURE=false

# Business configuration
DEFAULT_CURRENCY=INR
APP_TIMEZONE=Asia/Kolkata
LATE_GRACE_MINUTES=10

# Payroll mail; blank SMTP_HOST uses local JSON transport
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="PeoplePay360 Payroll <payroll@peoplepay.local>"

# Canonical local-demo accounts
SEED_EMPLOYEE_USERNAME=employee
SEED_EMPLOYEE_PASSWORD=Employee123!
SEED_HR_MANAGER_USERNAME=hr.manager
SEED_HR_MANAGER_PASSWORD=HrManager123!
SEED_HR_PAYROLL_USER_USERNAME=hr.payroll.user
SEED_HR_PAYROLL_USER_PASSWORD=HrPayrollUser123!
SEED_HR_PAYROLL_MANAGER_USERNAME=hr.payroll.manager
SEED_HR_PAYROLL_MANAGER_PASSWORD=HrPayrollManager123!
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=Admin123!
```

### Environment reference

| Variable | Requirement/default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT` | `8000` | HTTP port |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed browser origins |
| `DATABASE_URL` | Required | MySQL/MariaDB connection URL including database |
| `JWT_ACCESS_SECRET` | Required; minimum 16 characters | Access-token signing secret |
| `JWT_ACCESS_TTL_MINUTES` | `15` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh-token lifetime |
| `COOKIE_SECURE` | `false` | Set `true` for production HTTPS |
| `DEFAULT_CURRENCY` | Code default `USD`; example `INR` | Three-letter currency code |
| `APP_TIMEZONE` | Code default `UTC`; example `Asia/Kolkata` | Valid IANA timezone |
| `LATE_GRACE_MINUTES` | `0` | Minutes after scheduled start before lateness |
| `SMTP_HOST` | Optional | Blank uses deterministic JSON transport |
| `SMTP_PORT` | `587` with SMTP | SMTP port |
| `SMTP_SECURE` | `false` | SMTP TLS setting |
| `SMTP_USER`, `SMTP_PASS` | Optional pair | Both must be provided together |
| `MAIL_FROM` | Required when `SMTP_HOST` is set | Payslip sender |
| `SEED_<ROLE>_USERNAME/PASSWORD` | Defaults above | Canonical seeded credentials |

Seed usernames must be unique case-insensitively. They must be 3-50 characters using letters, numbers, dots, underscores, `@`, or hyphens. Seed passwords must contain 8-200 characters.

Script-only variables:

- `EPHEMERAL_PORT`: ephemeral MySQL port; default `3307`, while `0` requests a free port.
- `API_URL`: smoke API root; default `http://localhost:8000/api/v1`.

## Database setup

Choose one option.

### Option A: Docker MySQL 8.4

`docker-compose.yml` starts only MySQL. It does not start the API or frontend.

```powershell
docker compose up -d
docker compose ps
```

Wait for MySQL to become healthy, then run:

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Default Docker connection:

```dotenv
DATABASE_URL="mysql://root:root@127.0.0.1:3306/peoplepay360"
```

Stop while retaining data:

```powershell
docker compose down
```

Permanently remove the local volume:

```powershell
docker compose down -v
```

> `docker compose down -v` deletes the Docker database data.

### Option B: Existing MySQL 8

The database must already exist. An example using the MySQL CLI:

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p -e "CREATE DATABASE IF NOT EXISTS peoplepay360 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Configure the real account:

```dotenv
DATABASE_URL="mysql://APP_USER:URL_ENCODED_PASSWORD@127.0.0.1:3306/peoplepay360"
```

Percent-encode reserved URL characters in credentials. Then run:

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Only run the demo seed on an empty local/demo database or one previously created by this seed.

### Option C: Ephemeral MySQL 8.4

This option downloads and runs a temporary real MySQL process, applies migrations, verifies tables, attempts to seed, and remains alive until stopped.

Terminal 1:

```powershell
npm run prisma:generate
$env:EPHEMERAL_PORT='3307'
npm run db:ephemeral
```

Use a free random port:

```powershell
$env:EPHEMERAL_PORT='0'
npm run db:ephemeral
```

Terminal 2 - copy the exact URL printed by Terminal 1:

```powershell
$env:DATABASE_URL='mysql://root@127.0.0.1:3307/peoplepay360'
npm run dev
```

Bash/zsh:

```bash
EPHEMERAL_PORT=3307 npm run db:ephemeral
# In another terminal, use the exact printed URL:
DATABASE_URL='mysql://root@127.0.0.1:3307/peoplepay360' npm run dev
```

Keep Terminal 1 open. Stopping it removes the temporary database. Verify its output reaches `[seed] done`; if it reports a seed warning, set the printed `DATABASE_URL` in another terminal and run `npm run prisma:seed` explicitly.

## Run the API

The database must be running, migrated, and seeded before demo logins can be used.

Development/watch mode:

```powershell
npm run dev
```

Expected API root:

```text
http://localhost:8000/api/v1
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health | ConvertTo-Json
```

Or:

```powershell
curl.exe -fsS http://localhost:8000/api/v1/health
```

A healthy response reports `status: "ok"` and `database: "up"`.

## Seeded demo accounts

`npm run prisma:seed` creates or synchronizes one canonical account per role. Login accepts either the username or linked work email.

| Role | Username | Default password | Work-email alias |
|---|---|---|---|
| `EMPLOYEE` | `employee` | `Employee123!` | `aarav.mehta@oxp.com` |
| `HR_MANAGER` | `hr.manager` | `HrManager123!` | `sara.khan@oxp.com` |
| `HR_PAYROLL_USER` | `hr.payroll.user` | `HrPayrollUser123!` | `vikram.singh@oxp.com` |
| `HR_PAYROLL_MANAGER` | `hr.payroll.manager` | `HrPayrollManager123!` | `maya.shah@oxp.com` |
| `ADMIN` | `admin` | `Admin123!` | `system.admin@peoplepay.local` |

On rerun, the seed synchronizes canonical usernames, password hashes, roles, and active status, and removes existing refresh sessions for those accounts.

### Seed behavior and safety

- Roles, departments, leave types, schedules, and payroll configuration are upserted.
- Representative employees/contracts/attendance/time-off data is created only when the database has no employees.
- Canonical account synchronization expects the representative non-admin employee emails to exist.
- A custom nonempty database without those employees can reject canonical-account setup.
- The seed is for local demos and tests, not production.

## Authentication and authorization

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin123!"
}
```

The username field accepts the canonical username or linked employee work email.

A successful response includes:

- JWT access token
- Token type and expiry
- Rotating opaque refresh token
- Refresh expiry
- User, employee, role, and permission data

Send the access token as:

```http
Authorization: Bearer <access-token>
```

The refresh token is also set in an httpOnly cookie scoped to `/api/v1/auth`.

Auth routes:

| Route | Purpose |
|---|---|
| `POST /auth/login` | Sign in with username/email and password |
| `POST /auth/refresh` | Rotate refresh token and issue a new access token |
| `POST /auth/logout` | Revoke refresh session and clear cookie |
| `GET /auth/me` | Return current user, role, employee, and permissions |

All routes above are relative to `/api/v1`.

### Permissions and scope

Permissions are defined in `src/auth/permissions.ts`. EMPLOYEE reads are scoped to the caller's own employee record; ADMIN receives all **27** code-defined permissions and unrestricted row scope. Non-admin holders of `users:manage` may create or mutate EMPLOYEE-role accounts only, while ADMIN can assign and manage every released role.

## API endpoints

All routes use the `/api/v1` prefix.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Authentication | `POST /auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Users and roles | `GET/POST /users`, `GET/PATCH /users/:id`, `GET /roles`, `GET /roles/permissions` |
| Departments | `GET/POST /departments`, `GET/PATCH/DELETE /departments/:id` |
| Leave types | `GET/POST /leave-types`, `GET/PATCH/DELETE /leave-types/:id` |
| Work schedules | `GET/POST /work-schedules`, `GET/PATCH/DELETE /work-schedules/:id` |
| Employees | `GET /employees/me`, `/employees/me/summary`, `/employees/me/schedule`; `GET/POST /employees`; `GET/PATCH/DELETE /employees/:id`; summary, terminate, contract, and schedule-assignment routes |
| Schedule assignments | `GET/POST /employees/:id/schedule-assignments`, `PATCH/DELETE /schedule-assignments/:id` |
| Contracts | `GET/POST /contracts`, `GET/PATCH/DELETE /contracts/:id`, `POST /contracts/:id/terminate` |
| Attendance | Session, clock-in/out, break-start/end, record/entry CRUD, and mark-absences routes under `/attendance` |
| Leave balances | Own read, CRUD, initialize, and recompute routes under `/leave-balances` |
| Time off | Request CRUD, approve, reject, cancel, and approval routes under `/time-off/requests` |
| Salary structures | `GET/POST /salary-structures`, `GET/PATCH/DELETE /salary-structures/:id`, reorder rules |
| Salary rules | `GET/POST /salary-rules`, `GET/PATCH/DELETE /salary-rules/:id` |
| Payruns | List/create/detail/delete, eligibility, warnings, compute, validate, mark paid, cancel, and send payslips |
| Payslips | List/detail/delete, recompute, and authenticated PDF |
| Payroll dashboard | `GET /dashboard/payroll?from&to&departmentId&contractType` |

### List convention

List endpoints accept common parameters:

```text
page
pageSize
sort
order
q
```

They may also accept module-specific filters. Responses use:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### Error convention

```json
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Common statuses:

| Status | Meaning |
|---|---|
| 400 | Validation error |
| 401 | Missing/invalid authentication |
| 403 | Authenticated but forbidden |
| 404 | Resource not found |
| 409 | Conflict/duplicate/overlap |
| 422 | Business-rule violation |

Dates use `YYYY-MM-DD`; timestamps use ISO 8601.

## Important business rules

| Rule | Location |
|---|---|
| Weekly hours derived from work days and start/end times | `src/modules/work-schedules` |
| Schedule assignments cannot overlap | `src/modules/employees/service.ts` |
| One active contract per employee/period; automatic expiry | `src/modules/contracts/service.ts` |
| Attendance punch state machine and derived totals | `src/modules/attendance/derive.ts` |
| Day close creates absent/on-leave/week-off records | `src/modules/attendance/service.ts` |
| Time-off duration uses work schedules; approvals consume balance | `src/modules/time-off/service.ts` |
| Remaining/available leave values are derived; balances can be recomputed | `src/modules/leave-balances/service.ts` |
| Salary rules validate method operands, order, references, and formulas | `src/modules/salary-rules`, `src/modules/payroll` |
| Payroll lifecycle protects validated/paid history | `src/modules/payruns`, `src/modules/payslips` |
| Dashboard applies common live filters | `src/modules/dashboard/service.ts` |
| ADMIN manages all roles; lower account managers are employee-only | `src/modules/users/service.ts` |

## Project structure

```text
ts-backend/
|-- prisma/
|   |-- migrations/          Committed MySQL migrations
|   |-- schema.prisma        Data model
|   `-- seed.ts              Representative demo seed
|-- scripts/
|   |-- ephemeral-db.ts      Temporary MySQL helper
|   `-- smoke.ts             End-to-end API smoke suite
|-- src/
|   |-- auth/                Permissions and actor types
|   |-- config/              Validated environment
|   |-- generated/prisma/    Generated Prisma Client
|   |-- lib/                 Shared infrastructure/rules
|   |-- middleware/          Authentication, authorization, errors
|   |-- modules/             Feature routers/schemas/services
|   |-- app.ts               Express app construction
|   |-- index.ts             Database connection and HTTP server
|   `-- routes.ts            API route registration
|-- .env.example
|-- docker-compose.yml
|-- package.json
|-- prisma.config.ts
`-- tsconfig.json
```

## Commands

| Command | Implementation/purpose |
|---|---|
| `npm ci` | Install exact dependencies from the lockfile |
| `npm run dev` | `tsx watch src/index.ts` - development server |
| `npm run build` | Generate Prisma Client and compile TypeScript |
| `npm start` | Run compiled `dist/index.js` |
| `npm run typecheck` | Type-check without emitting files |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate -- --name NAME` | Author/apply a development migration |
| `npm run prisma:deploy` | Apply committed migrations |
| `npm run prisma:seed` | Run the representative seed |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run smoke` | Run the mutating end-to-end API smoke suite |
| `npm run db:ephemeral` | Start temporary MySQL, migrate, inspect, seed, and keep alive |

## Prisma workflow

### Fresh database

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

### After pulling migration changes

```powershell
npm run prisma:generate
npm run prisma:deploy
```

### Author a migration

1. Edit `prisma/schema.prisma`.
2. Use a local development database.
3. Run:

```powershell
npm run prisma:migrate -- --name describe_the_change
```

4. Review the generated SQL in `prisma/migrations`.
5. Validate:

```powershell
npm run prisma:generate
npm run typecheck
npm test
```

Use `npm run prisma:deploy` to apply committed migrations in production. Do not use `migrate dev` as the normal deployment command.

## Verification

### Static and unit checks

```powershell
npm run prisma:generate
npm run typecheck
npm test
npm run build
```

The unit tests cover pure rules and do not require a database.

### Migration status

```powershell
npx prisma migrate status
```

### End-to-end smoke

Start a seeded database and the API, then run:

```powershell
npm run smoke
```

Target another API URL:

PowerShell:

```powershell
$env:API_URL='http://localhost:8000/api/v1'
npm run smoke
```

Bash/zsh:

```bash
API_URL='http://localhost:8000/api/v1' npm run smoke
```

The smoke suite logs in as all five roles, walks every released module, performs real writes, prints its current passed/total result, and exits nonzero on failure. Run it only against disposable/local seeded data, never production.

## Production build and start

Supply production environment variables securely, then:

```powershell
$env:NODE_ENV='production'
npm run build
npm start
```

Before production:

- Use a least-privilege database account.
- Use a strong JWT secret.
- Set exact trusted `CORS_ORIGIN` values.
- Serve through HTTPS and set `COOKIE_SECURE=true`.
- Configure SMTP securely if real payslip delivery is needed.
- Apply committed migrations with `npm run prisma:deploy` before starting the new release.
- Do not run the representative seed or smoke suite on production.

This repository does not currently include an API Dockerfile or automatic migration-on-start wrapper.

## Troubleshooting

### Invalid environment configuration

The API validates environment values at startup and reports every invalid field. Check:

- `DATABASE_URL` exists.
- `JWT_ACCESS_SECRET` has at least 16 characters.
- SMTP username/password are both present or both absent.
- `MAIL_FROM` is present when `SMTP_HOST` is configured.
- `APP_TIMEZONE` is a valid IANA name.
- Seed usernames are valid and unique.

### Prisma Client module is missing

```powershell
npm run prisma:generate
```

### Database connection fails

1. Confirm MySQL is running and the database exists.
2. Verify `DATABASE_URL`, port, credentials, and URL encoding.
3. Run:

```powershell
npx prisma migrate status
```

For Docker:

```powershell
docker compose ps
docker compose logs mysql
```

### Port 8000 is occupied

Set another backend port:

```powershell
$env:PORT='8001'
npm run dev
```

Also update frontend `NEXT_PUBLIC_API_URL` and restart the frontend.

### Browser CORS or refresh-cookie errors

Local defaults expect:

```text
Frontend origin: http://localhost:3000
API origin:      http://localhost:8000
```

Set:

```dotenv
CORS_ORIGIN=http://localhost:3000
```

Avoid mixing `localhost` and `127.0.0.1` for browser-facing URLs because cookies are host-scoped.

### Seed login fails

Rerun the seed to synchronize canonical accounts:

```powershell
npm run prisma:seed
```

Confirm you are using current role-specific names such as `SEED_HR_MANAGER_PASSWORD` and `SEED_HR_PAYROLL_MANAGER_PASSWORD`.

### Seed fails on a custom nonempty database

The canonical accounts depend on representative employee emails. Use an empty local database, restore the expected employees, or do not run the demo seed against that database.

### Ephemeral MySQL fails on Windows

- Install the Microsoft Visual C++ 2015-2022 x64 Redistributable.
- Allow the first-run download to complete.
- Set `EPHEMERAL_PORT=0` if port 3307 is occupied.
- If a synced directory causes repeated file-locking errors, use a nonsynced development directory.

### SMTP is not configured

This is valid locally. With blank `SMTP_HOST`, payroll email uses deterministic JSON transport and does not send external mail.

## Security notes

- Never commit `.env`, database dumps, tokens, or credentials.
- Rotate all demo passwords in shared environments.
- Do not expose a seeded demo database to an untrusted network.
- Keep access-token lifetimes short.
- Deactivation/password changes revoke refresh tokens; existing access JWTs last until expiry.
- Review dependency audit findings before applying potentially breaking automated fixes.

## Related documentation

- [Full-stack setup](../README.md)
- [Frontend setup](../frontend/README.md)
- [System design](../docs/system-design.md)
- [Build and verification plan](../docs/build-plan.md)
- [Overall implementation plan](../docs/overall-implementation-plan.md)
- [Payroll implementation plan](../docs/phase-3-plan.md)
