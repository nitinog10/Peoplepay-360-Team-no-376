# PeoplePay360 Frontend

Next.js 16 frontend for PeoplePay360's employee, HR, payroll, and administration workflows.

For complete full-stack setup, database options, and backend instructions, see the [root README](../README.md).

## Stack

- Next.js 16.3.4 with the App Router
- React 19 and TypeScript
- Tailwind CSS and shadcn/Radix UI
- TanStack Query
- React Hook Form and Zod
- Recharts

## Prerequisites

- Node.js 24.x recommended
- npm
- A running PeoplePay360 API

The local frontend expects the API at:

```text
http://localhost:8000/api/v1
```

Set up and start the API from [`../ts-backend`](../ts-backend/README.md) before testing authenticated pages.

## Installation

Run these commands from the `frontend` directory.

### 1. Install dependencies

```powershell
npm ci
```

Use `npm ci` for reproducible installation from `package-lock.json`. Use `npm install` only when intentionally changing dependencies.

### 2. Create the local environment file

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Bash/zsh:

```bash
cp .env.example .env.local
```

### 3. Configure the API URL

`frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Requirements:

- Include the `/api/v1` prefix.
- Do not add a trailing slash.
- Use the same browser-facing host configured in the backend's `CORS_ORIGIN`.
- Never put secrets in `NEXT_PUBLIC_*`; these values are included in browser code.
- Restart the development server or rebuild after changing this value.

## Run in development

Ensure the database and backend are already running, then execute:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

Login page:

```text
http://localhost:3000/login
```

The development server uses Turbopack and automatically reloads when frontend files change.

## Seeded demo logins

These accounts exist after the backend demo seed runs with its default environment values. Login accepts either the username or linked work email.

| Role | Username | Password | Work-email alias |
|---|---|---|---|
| Employee | `employee` | `Employee123!` | `aarav.mehta@oxp.com` |
| HR Manager | `hr.manager` | `HrManager123!` | `sara.khan@oxp.com` |
| HR Payroll User | `hr.payroll.user` | `HrPayrollUser123!` | `vikram.singh@oxp.com` |
| HR Payroll Manager | `hr.payroll.manager` | `HrPayrollManager123!` | `maya.shah@oxp.com` |
| Administrator | `admin` | `Admin123!` | `system.admin@peoplepay.local` |

If backend seed credentials were customized, use those values instead.

## Application routes

Navigation and page controls are permission-driven from the authenticated session. The backend still enforces every permission and row-scope boundary.

| Area | Routes |
|---|---|
| Login | `/login` |
| My Space | `/` |
| Employees | `/employees`, `/employees/new`, `/employees/me`, `/employees/[id]` |
| Departments | `/departments` |
| Work schedules | `/work-schedules` |
| Contracts | `/contracts`, `/contracts/[id]` |
| Attendance | `/attendance`, `/attendance/[id]` |
| Time off | `/time-off`, `/time-off/requests`, `/time-off/requests/[id]` |
| Leave balances/types | `/time-off/balances`, `/time-off/types` |
| Payroll dashboard | `/payroll/dashboard` |
| Payruns | `/payroll/payruns`, `/payroll/payruns/[id]` |
| Payslips | `/payroll/payslips`, `/payroll/payslips/[id]` |
| Salary configuration | `/payroll/structures`, `/payroll/structures/[id]`, `/payroll/rules` |
| User management | `/users` |
| Roles and permissions | `/admin/roles` |

The `/scratch` and `/scratch/lists` routes are developer reference pages and should not be treated as production features.

## Authentication behavior

- Access tokens are held in the frontend session layer rather than local storage.
- The backend issues a rotating refresh token in an httpOnly cookie scoped to `/api/v1/auth`.
- On application load, the session provider attempts to restore the session through refresh.
- A failed API request caused by an expired access token is refreshed and retried when possible.
- Routes and controls use permissions returned by `GET /auth/me`, not hard-coded role checks.
- A backend 403 is rendered as a forbidden state even if a user manually enters a restricted URL.

Local cookie and CORS behavior works best when both apps consistently use `localhost`:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

## Project structure

```text
frontend/
|-- app/
|   |-- (app)/               Authenticated application routes
|   |-- (auth)/              Login route/layout
|   `-- (dev)/               Developer reference routes
|-- components/
|   |-- shell/               Navigation and app shell
|   |-- ui/                  Shared UI primitives
|   `-- ...                  Feature components
|-- lib/
|   |-- api/                 Typed API client and endpoint definitions
|   |-- auth/                Session/auth support
|   `-- ...                  Shared utilities
|-- public/
|-- .env.example
|-- package.json
`-- next.config.ts
```

## Commands

Run all commands from `frontend`.

| Command | Purpose |
|---|---|
| `npm ci` | Install exact dependencies from the lockfile |
| `npm run dev` | Start the Next.js development server on port 3000 |
| `npm run build` | Create a production build |
| `npm run build -- --webpack` | Create the production build with the verified Webpack fallback |
| `npm start` | Serve an existing production build |
| `npm run lint` | Run ESLint |
| `npx next typegen` | Generate App Router types |
| `npx tsc --noEmit` | Type-check without writing output |

There is currently no frontend unit-test npm script.

## Validate the frontend

With dependencies and `.env.local` present:

```powershell
npx next typegen
npx tsc --noEmit
npm run lint
```

Production build on this Windows workspace:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
npm run build -- --webpack
```

Bash/zsh equivalent:

```bash
NODE_OPTIONS='--max-old-space-size=4096' npm run build -- --webpack
```

The Webpack flag is the verified fallback when the default builder exits abnormally on this Windows environment.

## Production build and start

Set the deployed API URL before building:

```dotenv
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

Then run:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
npm run build -- --webpack
npm start
```

By default, `npm start` serves the built application on port 3000.

`NEXT_PUBLIC_API_URL` is embedded at build time. Changing it after `npm run build` requires another build.

## Troubleshooting

### The page opens but every API request fails

1. Confirm the backend health endpoint works:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health | ConvertTo-Json
```

2. Check `NEXT_PUBLIC_API_URL` in `.env.local`.
3. Restart `npm run dev` after changing `.env.local`.
4. Confirm the URL includes `/api/v1` and has no trailing slash.

### CORS errors in the browser

The backend `CORS_ORIGIN` must include the exact frontend origin:

```dotenv
CORS_ORIGIN=http://localhost:3000
```

Avoid mixing `localhost` and `127.0.0.1` for browser-facing URLs because refresh cookies are host-scoped.

### Login returns 401

- Confirm the backend seed completed successfully.
- Use the current credentials listed above.
- If backend seed variables were changed, rerun `npm run prisma:seed` in `ts-backend`.
- Check that the account is active.

### Route types are missing or stale

```powershell
npx next typegen
npx tsc --noEmit
```

### Port 3000 is occupied

Stop the other process or start Next.js on another port:

```powershell
npm run dev -- --port 3001
```

When changing the frontend port, also update the backend `CORS_ORIGIN`.

### Build runs out of memory or the default builder exits

Use the verified Webpack build with a larger Node heap:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
npm run build -- --webpack
```

### Environment changes are ignored

`NEXT_PUBLIC_*` values are read when the dev server starts and embedded when a production build is created. Restart the server or rebuild.

## Deployment notes

- Serve the frontend over HTTPS.
- Set `NEXT_PUBLIC_API_URL` to the public HTTPS API root before building.
- Configure the backend `CORS_ORIGIN` to the exact deployed frontend origin.
- Do not put private keys, passwords, or tokens in `NEXT_PUBLIC_*` variables.
- The backend should set `COOKIE_SECURE=true` in production.
- This repository does not currently include a frontend Dockerfile or managed-host deployment configuration.

## Related documentation

- [Full-stack setup](../README.md)
- [Backend setup and API reference](../ts-backend/README.md)
- [System design](../docs/system-design.md)
- [Build and verification plan](../docs/build-plan.md)
