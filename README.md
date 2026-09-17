# PeoplePay360

PeoplePay360 is a full-stack human resources, attendance, leave, payroll, and system-administration application. The frontend uses Next.js and React; the API uses Express, TypeScript, Prisma, and MySQL.

> Team 376

## Contents

- [Features and roles](#features-and-roles)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Fresh-clone setup](#fresh-clone-setup)
- [Environment configuration](#environment-configuration)
- [Database options](#database-options)
- [Run the application](#run-the-application)
- [Seeded demo accounts](#seeded-demo-accounts)
- [URLs and ports](#urls-and-ports)
- [Available commands](#available-commands)
- [Database workflow](#database-workflow)
- [Verification and tests](#verification-and-tests)
- [Production build and start](#production-build-and-start)
- [Troubleshooting](#troubleshooting)
- [Security and deployment](#security-and-deployment)
- [Further documentation](#further-documentation)

## Features and roles

| Role | Main capabilities |
|---|---|
| `EMPLOYEE` | Own profile, contracts, attendance, leave balances, and time-off requests |
| `HR_MANAGER` | Employees, departments, contracts, schedules, attendance, leave, and limited employee-login management |
| `HR_PAYROLL_USER` | HR capabilities plus payrun/payslip processing and read-only salary configuration |
| `HR_PAYROLL_MANAGER` | Payroll processing, salary configuration, dashboard, cancellation, and permitted deletion workflows |
| `ADMIN` | All code-defined permissions, unrestricted row scope, all-role user management, and the role-permission matrix |

Major modules include:

- Authentication with JWT access tokens and rotating refresh tokens
- Permission-based frontend navigation and backend authorization
- Employees, departments, contracts, and work schedules
- Attendance clock-in/out, breaks, corrections, and derived totals
- Leave types, balances, requests, and approval workflows
- Salary structures, rules, payruns, payslips, PDF generation, and payroll reporting
- User administration and a read-only roles/permissions matrix

## Technology stack

### Frontend

- Next.js 16.3.4 with the App Router
- React 19 and TypeScript
- Tailwind CSS and shadcn/Radix UI
- TanStack Query
- React Hook Form and Zod
- Recharts

### Backend

- Node.js, Express 5, and TypeScript
- Prisma with MySQL 8
- JWT, bcrypt, and rotating refresh tokens
- Vitest
- Nodemailer and PDFKit

## Repository structure

```text
Peoplepay-360/
|-- frontend/                 Next.js web application
|   |-- app/                  App Router pages and layouts
|   |-- components/           Shared and feature components
|   |-- lib/                  API client, session, and utilities
|   |-- .env.example
|   `-- package.json
|-- ts-backend/               Express API
|   |-- prisma/               Schema, migrations, and seed
|   |-- scripts/              Smoke and ephemeral-MySQL tooling
|   |-- src/                  API source
|   |-- .env.example
|   |-- docker-compose.yml    MySQL only
|   `-- package.json
|-- docs/                     Design and implementation documents
`-- README.md
```

There is no root `package.json`. Run npm, Prisma, and application commands inside `frontend` or `ts-backend`.

## Prerequisites

| Requirement | Notes |
|---|---|
| Git | Required to clone the repository |
| Node.js | **Node 24.x is recommended** for the complete install/build/test workflow |
| npm | Use the npm bundled with Node; both packages have npm lockfiles |
| Database | MySQL 8.x, Docker, or the included ephemeral MySQL option |
| Docker | Optional; Compose starts MySQL only, not the applications |

Next.js requires Node 20.9 or newer, while the locked Vitest version requires Node 22.12+, Node 24, or another supported newer range. Node 24 avoids using different runtimes for the two packages.

Check your tools:

```powershell
node --version
npm --version
git --version
```

The ephemeral database on Windows also requires the Microsoft Visual C++ 2015-2022 x64 Redistributable. Its first run downloads a MySQL 8.4 binary and needs network access and free disk space.

## Fresh-clone setup

### 1. Clone the repository

PowerShell:

```powershell
git clone https://github.com/nitinog10/Peoplepay-360.git
Set-Location .\Peoplepay-360
```

Bash/zsh:

```bash
git clone https://github.com/nitinog10/Peoplepay-360.git
cd Peoplepay-360
```

### 2. Install both packages

PowerShell, from the repository root:

```powershell
Set-Location .\ts-backend
npm ci
Set-Location ..\frontend
npm ci
Set-Location ..
```

Bash/zsh:

```bash

npm ci
cd ../frontend
npm ci
cd ..
```

Use `npm ci` for reproducible installation from the committed lockfiles. Use `npm install` only when intentionally changing dependencies and updating a lockfile.

### 3. Create local environment files

PowerShell, from the repository root:

```powershell
Copy-Item .\ts-backend\.env.example .\ts-backend\.env
Copy-Item .\frontend\.env.example .\frontend\.env.local
```

Bash/zsh:

```bash
cp ts-backend/.env.example ts-backend/.env
cp frontend/.env.example frontend/.env.local
```

Local environment files are ignored by Git. Never commit `.env` or `.env.local`.

### 4. Generate Prisma Client

After configuring `ts-backend/.env` as described below:

```powershell
Set-Location .\ts-backend
npm run prisma:generate
Set-Location ..
```

Prisma Client is generated under `ts-backend/src/generated/prisma` and is not committed.

## Environment configuration

### Backend: `ts-backend/.env`

Generate a development JWT secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the result into `JWT_ACCESS_SECRET`. The following is a complete local configuration. Change `DATABASE_URL` for the database option selected in the next section.

```dotenv
NODE_ENV=development
PORT=8000
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000

DATABASE_URL=mysql://root:root@127.0.0.1:3306/peoplepay360

JWT_ACCESS_SECRET=replace-with-a-random-value-of-at-least-16-characters
JWT_ACCESS_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
COOKIE_SECURE=false

DEFAULT_CURRENCY=INR
APP_TIMEZONE=Asia/Kolkata
LATE_GRACE_MINUTES=10

# Leave SMTP_HOST blank to use local JSON transport without sending mail.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="PeoplePay360 Payroll <payroll@peoplepay.local>"

# Canonical local-demo accounts used by the current backend.
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

The five usernames must be unique. Usernames must contain 3-50 supported characters and passwords must contain at least 8 characters. These are public local-demo defaults; replace them in any shared environment.

#### Backend environment reference

| Variable | Requirement/default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT` | `8000` | API port |
| `LOG_LEVEL` | `info` | Logging level |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed frontend origins |
| `DATABASE_URL` | Required | MySQL URL including database name |
| `JWT_ACCESS_SECRET` | Required, minimum 16 characters | Access-token signing secret |
| `JWT_ACCESS_TTL_MINUTES` | `15` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh-token lifetime |
| `COOKIE_SECURE` | `false` | Set to `true` behind production HTTPS |
| `DEFAULT_CURRENCY` | Code default `USD`; local example `INR` | Three-letter currency code |
| `APP_TIMEZONE` | Code default `UTC`; local example `Asia/Kolkata` | Valid IANA timezone |
| `LATE_GRACE_MINUTES` | `0` | Grace period before an arrival is late |
| `SMTP_HOST` | Optional | Blank selects local JSON transport |
| `SMTP_PORT` | `587` when SMTP is enabled | SMTP port |
| `SMTP_SECURE` | `false` | SMTP TLS mode |
| `SMTP_USER`, `SMTP_PASS` | Optional pair | Supply both or neither |
| `MAIL_FROM` | Required when SMTP is enabled | Payslip sender address |
| Role-specific `SEED_*` variables | Defaults shown above | Canonical demo credentials |

Script-only variables:

- `EPHEMERAL_PORT`: temporary MySQL port; defaults to `3307`, while `0` chooses a free port.
- `API_URL`: smoke-test API root; defaults to `http://localhost:8000/api/v1`.

### Frontend: `frontend/.env.local`

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

The value must include `/api/v1` and must not end with a slash. It is included in browser code, so never place secrets in `NEXT_PUBLIC_*`. Restart or rebuild the frontend after changing it.

## Database options

Choose one database option.

### Option A: Docker MySQL 8.4

The Compose file starts **only MySQL** on port 3306.

From the repository root:

```powershell
Set-Location .\ts-backend
docker compose version
docker compose up -d
docker compose ps
```

Wait until MySQL reports healthy, then apply migrations and seed:

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Use this connection in `.env`:

```dotenv
DATABASE_URL=mysql://root:root@127.0.0.1:3306/peoplepay360
```

Stop MySQL while preserving data:

```powershell
docker compose down
```

Intentionally erase the local Docker database and volume:

```powershell
docker compose down -v
```

> `docker compose down -v` permanently deletes the local database volume.

### Option B: Existing MySQL 8

Create the database with an administrator account. This command prompts for the password instead of putting it in shell history:

```powershell
mysql -h 127.0.0.1 -P 3306 -u root -p -e "CREATE DATABASE IF NOT EXISTS peoplepay360 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Set the real connection in `ts-backend/.env`:

```dotenv
DATABASE_URL=mysql://APP_USER:URL_ENCODED_PASSWORD@127.0.0.1:3306/peoplepay360
```

Percent-encode reserved URL characters in database credentials. Then run from `ts-backend`:

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Only seed an empty local/demo database or a database previously created by this seed. Do not run the representative demo seed against production or unrelated shared data.

### Option C: Ephemeral MySQL 8.4

Use this option when Docker and MySQL are unavailable. The helper downloads and starts a temporary real MySQL instance, applies migrations, verifies the schema, seeds data, and stays active until stopped.

Terminal 1, from the repository root:

```powershell
Set-Location .\ts-backend
npm run prisma:generate
$env:EPHEMERAL_PORT='3307'
npm run db:ephemeral
```

Use a free random port instead:

```powershell
$env:EPHEMERAL_PORT='0'
npm run db:ephemeral
```

Terminal 2 - copy the exact `DATABASE_URL` printed by Terminal 1:

```powershell
Set-Location .\ts-backend
$env:DATABASE_URL='mysql://root@127.0.0.1:3307/peoplepay360'
npm run dev
```

Bash/zsh equivalent:

```bash
cd ts-backend
EPHEMERAL_PORT=3307 npm run db:ephemeral
# In a second terminal, using the exact printed URL:
DATABASE_URL='mysql://root@127.0.0.1:3307/peoplepay360' npm run dev
```

Stopping Terminal 1 removes the ephemeral database. Confirm that its output reaches `[seed] done`. If it reports a seed warning, use the printed `DATABASE_URL` and run `npm run prisma:seed` explicitly in another backend terminal.

## Run the application

The database must be running and migrated before the backend starts.

### Terminal 1: backend

For Docker or an existing database configured in `ts-backend/.env`:

```powershell
Set-Location .\ts-backend
npm run dev
```

Expected API root:

```text
http://localhost:8000/api/v1
```

### Terminal 2: frontend

```powershell
Set-Location .\frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

### Recommended first-run order

1. Start MySQL.
2. Apply migrations and seed from `ts-backend` unless the ephemeral helper already did so.
3. Start the backend with `npm run dev`.
4. Confirm API health.
5. Start the frontend with `npm run dev`.
6. Open `/login` and use a seeded account.

## Seeded demo accounts

Login accepts either the canonical username or the linked work email.

| Role | Username | Default password | Work-email alias |
|---|---|---|---|
| Employee | `employee` | `Employee123!` | `aarav.mehta@oxp.com` |
| HR Manager | `hr.manager` | `HrManager123!` | `sara.khan@oxp.com` |
| HR Payroll User | `hr.payroll.user` | `HrPayrollUser123!` | `vikram.singh@oxp.com` |
| HR Payroll Manager | `hr.payroll.manager` | `HrPayrollManager123!` | `maya.shah@oxp.com` |
| Administrator | `admin` | `Admin123!` | `system.admin@peoplepay.local` |

The seed synchronizes these usernames, passwords, roles, and active status on rerun and revokes their existing refresh sessions. Change the defaults for shared or remotely accessible environments.

## URLs and ports

| Service | Default URL/port |
|---|---|
| Frontend | `http://localhost:3000` |
| Login | `http://localhost:3000/login` |
| Backend API | `http://localhost:8000/api/v1` |
| API health | `http://localhost:8000/api/v1/health` |
| Docker/existing MySQL | `127.0.0.1:3306` |
| Ephemeral MySQL | `127.0.0.1:3307` or the printed random port |

Main API namespaces under `/api/v1`:

```text
/auth
/users
/roles
/departments
/leave-types
/work-schedules
/employees
/schedule-assignments
/contracts
/attendance
/leave-balances
/time-off
/dashboard
/salary-structures
/salary-rules
/payruns
/payslips
```

See [`ts-backend/README.md`](ts-backend/README.md) for detailed endpoints and business rules.

## Available commands

There are no root npm scripts. Run commands inside the indicated package.

### Frontend commands

Run from `frontend`:

| Command | Purpose |
|---|---|
| `npm ci` | Install exactly from `package-lock.json` |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run build -- --webpack` | Build with the verified Webpack fallback |
| `npm start` | Serve an existing production build |
| `npm run lint` | Run ESLint |
| `npx next typegen` | Generate Next.js route types |
| `npx tsc --noEmit` | Type-check without writing files |

The frontend currently has no unit-test npm script.

### Backend commands

Run from `ts-backend`:

| Command | Purpose |
|---|---|
| `npm ci` | Install exactly from `package-lock.json` |
| `npm run dev` | Start the API in TypeScript watch mode |
| `npm run build` | Generate Prisma Client and compile to `dist` |
| `npm start` | Run `dist/index.js` |
| `npm run typecheck` | Type-check without emitting files |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:deploy` | Apply committed migrations |
| `npm run prisma:migrate -- --name NAME` | Author a development migration |
| `npm run prisma:seed` | Seed lookup, demo, payroll, and account data |
| `npm test` | Run the one-shot Vitest suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run smoke` | Run the mutating end-to-end API smoke suite |
| `npm run db:ephemeral` | Start, migrate, inspect, seed, and retain temporary MySQL |

## Database workflow

Always run Prisma commands from `ts-backend`.

### Fresh database

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

### After pulling schema or migration changes

```powershell
npm run prisma:generate
npm run prisma:deploy
```

### Author a schema change

1. Edit `ts-backend/prisma/schema.prisma`.
2. Use a local development database.
3. Create a named migration:

```powershell
npm run prisma:migrate -- --name describe_the_change
```

4. Review the SQL under `prisma/migrations`.
5. Regenerate and validate:

```powershell
npm run prisma:generate
npm run typecheck
npm test
```

Use `npm run prisma:deploy`, not `prisma migrate dev`, to apply committed migrations in production or a normal fresh clone.

### Seed behavior and safety

- Lookup records and payroll configuration are upserted.
- Representative transactions are created only when the database has no employees.
- Canonical role accounts are synchronized on each seed run.
- A custom nonempty database without the representative employee emails can reject canonical-account creation.
- The seed is for local demos and tests, not production data.

## Verification and tests

### API health

PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health | ConvertTo-Json
```

Or use curl on Windows:

```powershell
curl.exe -fsS http://localhost:8000/api/v1/health
```

Bash/zsh:

```bash
curl -fsS http://localhost:8000/api/v1/health
```

A healthy response contains `"status":"ok"` and `"database":"up"`.

### Migration status

From `ts-backend`:

```powershell
npx prisma migrate status
```

### Backend checks

```powershell
Set-Location .\ts-backend
npm run prisma:generate
npm run typecheck
npm test
npm run build
```

The unit suite covers pure business rules and does not require a running database.

### Frontend checks

```powershell
Set-Location .\frontend
npx next typegen
npx tsc --noEmit
npm run lint
$env:NODE_OPTIONS='--max-old-space-size=4096'
npm run build -- --webpack
```

Bash/zsh build equivalent:

```bash
NODE_OPTIONS='--max-old-space-size=4096' npm run build -- --webpack
```

### End-to-end smoke suite

Start a seeded database and the backend, then run from `ts-backend`:

```powershell
npm run smoke
```

Target another API root in PowerShell:

```powershell
$env:API_URL='http://localhost:8000/api/v1'
npm run smoke
```

Bash/zsh:

```bash
API_URL='http://localhost:8000/api/v1' npm run smoke
```

The smoke suite logs in as all five roles, performs real writes, prints its current passed/total count, and exits nonzero on failure. Run it only against a disposable/local seeded database, never production.

## Production build and start

This repository currently has no application Dockerfiles or full-stack deployment Compose file. Build and run both Node applications separately.

### Backend

```powershell
Set-Location .\ts-backend
$env:NODE_ENV='production'
npm run build
npm start
```

Supply production database, JWT, CORS, cookie, SMTP, and account settings through the deployment environment.

### Frontend

```powershell
Set-Location .\frontend
$env:NODE_OPTIONS='--max-old-space-size=4096'
npm run build -- --webpack
npm start
```

Set `NEXT_PUBLIC_API_URL` to the deployed API before building because it is embedded at build time.

## Troubleshooting

### No `package.json` at the repository root

Change into the applicable package:

```powershell
Set-Location .\ts-backend
# or
Set-Location .\frontend
```

### Node or Vitest engine errors

Use Node 24.x. Next.js accepts some older Node versions, but the locked test toolchain requires a newer supported runtime.

### Prisma Client cannot be found

```powershell
Set-Location .\ts-backend
npm run prisma:generate
```

### Backend cannot connect to MySQL

1. Confirm MySQL is running and the database exists.
2. Verify `DATABASE_URL`, host, port, credentials, and URL encoding.
3. Check migration state:

```powershell
npx prisma migrate status
```

4. For Docker, inspect:

```powershell
docker compose ps
docker compose logs mysql
```

### Port 3000, 8000, 3306, or 3307 is occupied

Stop the conflicting process or choose another port. If the API port changes, update `PORT` and `NEXT_PUBLIC_API_URL`. If the frontend origin changes, update `CORS_ORIGIN`. For ephemeral MySQL, set `EPHEMERAL_PORT=0`.

### Login fails after changing seed credentials

Synchronize canonical accounts:

```powershell
Set-Location .\ts-backend
npm run prisma:seed
```

Use current role-specific names such as `SEED_HR_MANAGER_PASSWORD` and `SEED_HR_PAYROLL_MANAGER_PASSWORD`. Keep smoke-process variables synchronized with seed values.

### CORS, refresh-cookie, or repeated 401 errors

Local defaults expect:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- `CORS_ORIGIN=http://localhost:3000`

Avoid mixing `localhost` and `127.0.0.1` in browser-facing URLs unless all related settings are updated. Refresh cookies are host-scoped.

### Frontend environment changes do not appear

Restart `npm run dev`, or rebuild. `NEXT_PUBLIC_*` values are compiled into frontend output.

### Ephemeral MySQL does not start on Windows

- Install the Microsoft Visual C++ 2015-2022 x64 Redistributable.
- Allow the first-run MySQL download to finish.
- Try `EPHEMERAL_PORT=0` if port 3307 is occupied.
- If OneDrive causes repeated `EPERM`/locking errors, use a nonsynced development directory.

### Docker starts MySQL but not the apps

This is expected. `ts-backend/docker-compose.yml` is database-only. Start `npm run dev` separately in `ts-backend` and `frontend`.

### Seed fails on a nonempty custom database

The representative seed expects its canonical employee emails. Use an empty local database, restore the expected representative dataset, or do not demo-seed that database. Never force demo seed behavior against production data.

### PowerShell and Bash environment syntax

PowerShell:

```powershell
$env:NAME='value'
npm run dev
```

Bash/zsh:

```bash
NAME='value' npm run dev
# or
export NAME='value'
npm run dev
```

## Security and deployment

Before a shared or production deployment:

- Replace all demo passwords and the JWT secret.
- Use a least-privilege database account instead of MySQL root.
- Use HTTPS and set `COOKIE_SECURE=true`.
- Restrict `CORS_ORIGIN` to exact trusted frontend origins.
- Configure SMTP secrets through a secret manager if real mail is required.
- Do not expose the seeded demo database to an untrusted network.
- Do not run the demo seed or smoke suite against production.
- Keep `.env`, `.env.local`, dumps, tokens, and credentials out of Git.
- Review dependency updates and audit findings with compatibility testing.

## Further documentation

- [`ts-backend/README.md`](ts-backend/README.md) - API endpoints and backend business rules
- [`docs/build-plan.md`](docs/build-plan.md) - implementation and verification history
- [`docs/overall-implementation-plan.md`](docs/overall-implementation-plan.md) - architecture and phase status
- [`docs/system-design.md`](docs/system-design.md) - system design
- [`docs/phase-1-plan.md`](docs/phase-1-plan.md) - employee and HR design
- [`docs/phase-3-plan.md`](docs/phase-3-plan.md) - payroll schema and lifecycle
- [`docs/UI_REFERENCE.md`](docs/UI_REFERENCE.md) - UI reference
