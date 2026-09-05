# PeoplePay360 — Phase-wise Build Plan (executable)

Ordered, one-step-at-a-time build queue derived from `docs/overall-implementation-plan.md` (status audit), `docs/phase-1-plan.md` (Phases 1–2 schema/rules/API), and `docs/phase-3-plan.md` (implemented provisional payroll contract). Those documents stay the source of truth for **what exists**; this file is the queue of **what to build next, in the order to build it**.

Written 2026-09-05 and fully refreshed after the combined Phase 1–4 delivery. Phase 1–4 backend and frontend are now ✅. The payroll schema remains the documented provisional implementation because authoritative Phase 3/4 team SQL is still unavailable; reconciliation remains required when that SQL arrives.

**Final P1/P2/P3/P4 verification — 2026-09-06.** P1-1…P1-5, P2-1…P2-10, P3-0…P3-12 and P4-1…P4-7 are implemented and the combined gate passed: frontend Next.js 16.3.4 Webpack production build (24/24 static pages), typecheck and zero-warning lint; backend Prisma generation and typecheck; **82/82** unit tests; fresh ephemeral MySQL 8.4.9 with both migrations and a repeatable seed; and **113/113** end-to-end smoke checks. Dashboard figures were independently reproduced from direct Prisma queries. The verified production-build command remains `npm run build -- --webpack`. Full Phase 4 evidence and known limitations are recorded in [§ Phase 4 final verification](#phase-4-final-verification-2026-09-06) at the end of this file. **P5-1 is now the next executable step.**

## How to use this file

1. **Work top to bottom.** No step depends on a step below it.
2. **One step = one work session / one commit.** Don't start a step whose `needs` are not ticked.
3. **Done means the gate ran.** Actually execute the "Done when" check (typecheck, build, smoke,
   click-through), then tick the board below and update the matching row in
   `docs/overall-implementation-plan.md`.
4. **Sizes:** S ≈ under an hour · M ≈ 1–3 h · L ≈ half a day. If a step outgrows its size, split it and
   add the new id to the board instead of quietly widening scope.
5. **⛔ = hard gate.** Nothing below a gate starts until it clears.
6. Business values stay out of components and out of code: schedules drive hours, leave types drive
   allocations, contracts drive pay, `permissions` drive the UI.

## Commands (verified against this repo)

Every `ts-backend` row below is a real npm script as of P0-1 — the old `npx …` spellings are gone.

| Where | Command |
|---|---|
| `ts-backend` typecheck | `npm run typecheck` |
| `ts-backend` migrate | `npm run prisma:migrate -- --name <change>` |
| `ts-backend` apply + seed | `npm run prisma:deploy && npm run prisma:seed` |
| `ts-backend` run | `npm run dev` → `http://localhost:8000/api/v1` |
| `ts-backend` throwaway DB | `npm run db:ephemeral` (`EPHEMERAL_PORT=3307` pins the port). This machine's baseline — no Docker, no local MySQL; see the comment at the top of `.env` |
| `ts-backend` unit tests | `npm test` — **82/82 tests in 5 files**, no database (current Phase 1–4 gate) |
| `ts-backend` smoke | `npm run smoke` (`API_URL` defaults to localhost:8000) — **113/113** across Phase 1–4 on fresh ephemeral MySQL 8.4.9 |
| `frontend` install / run | `npm install` · `npm run dev` → `http://localhost:3000` |
| `frontend` verify | `npx next typegen` · `npx tsc --noEmit` · `npm run lint` · `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run build -- --webpack` — combined Phase 1–4 gate green; Next.js 16.3.4 generated `/payroll/dashboard` and completed 24/24 static pages |

## The API contract every screen codes against (verified in source)

- Base `http://localhost:8000/api/v1`; `CORS_ORIGIN` defaults to `http://localhost:3000`, credentials on.
- `POST /auth/login {username | work email, password}` → `{ accessToken, expiresIn, tokenType,
  refreshToken, refreshExpiresAt, user }`. Refresh cookie `pp360_refresh` is httpOnly, path
  `/api/v1/auth` (same-site with :3000, so it rides along on refresh calls).
- `GET /auth/me` → user + `role` + **`permissions: string[]`**. Gate every menu entry, route and button
  off that array — never off the role string. Catalogue: `ts-backend/src/auth/permissions.ts`.
- Lists: `?page&pageSize&sort&order&q&<filters>` → `{ data, meta: { page, pageSize, total, totalPages } }`.
- Errors: `{ error: { code, message, details? } }` — 400 validation · 401/403 auth · 404 · 409 conflict
  (overlap, duplicate) · 422 rule violation (punch sequence, insufficient balance). Map `details` onto
  form fields; show 409/422 `message` as the form banner.

## Status board

Legend: ❌ not started · 🟡 in progress · ✅ done and gate passed.

| Step | What | Size | Needs | Status |
|---|---|---|---|---|
| **P0** | **Foundation & DX** | | | |
| P0-1 | npm scripts + README alignment | S | — | ✅ |
| P0-2 | Database up; migrate + seed + smoke re-verified | S | P0-1 | ✅ |
| P0-3 | vitest harness + unit tests for the pure rules | M | P0-1 | ✅ |
| **FE** | **Frontend platform (prerequisite for every phase's UI)** | | | |
| FE-1 | `npm install` + read the Next.js 16 docs → notes | S | — | ✅ |
| FE-2 | Toolchain: tokens, UI primitives, Query, RHF + zod | M | FE-1 | ✅ |
| FE-3 | Typed API client, session, refresh, route guard | L | FE-2 | ✅ |
| FE-4 | App shell: role-aware nav, header, 403/404 | M | FE-3 | ✅ |
| FE-5 | Attendance widget (session, clock in/out, breaks) | M | FE-4 | ✅ |
| FE-6 | Shared list & form primitives (table, filters, fields, kanban) | M | FE-4 | ✅ |
| **P1** | **Phase 1 — ① EMPLOYEE screens** | | | |
| P1-1 | My Space dashboard (`/`) | M | FE-5, FE-6 | ✅ |
| P1-2 | My profile (read-only employee form) | S | FE-6 | ✅ |
| P1-3 | My attendance list + day detail | M | FE-6 | ✅ |
| P1-4 | My time off: dashboard, requests, new request, cancel | L | FE-6 | ✅ |
| P1-5 | My balances + my contracts (read-only) | S | FE-6 | ✅ |
| **P2** | **Phase 2 — ② HR_MANAGER screens** | | | |
| P2-1 | Employees kanban + list + filters | L | FE-6 | ✅ |
| P2-2 | Employee form (tabs, smart buttons, terminate) | L | P2-1 | ✅ |
| P2-3 | Contracts list + form + terminate | M | P2-2 | ✅ |
| P2-4 | Working schedules + assignment history | M | P2-2 | ✅ |
| P2-5 | Attendance HR: filters, punch edits, mark-absences | L | P1-3 | ✅ |
| P2-6 | Time off decisions: approve / reject / cancel | M | P1-4 | ✅ |
| P2-7 | Allocations: edit, initialize-year, recompute | M | P1-4 | ✅ |
| P2-8 | Time off types list + form | S | FE-6 | ✅ |
| P2-9 | Departments list + form | S | FE-6 | ✅ |
| P2-10 | Users: create, link employee, role, activate | M | FE-6 | ✅ |
| **P3** | **Phase 3 — ③ HR_PAYROLL_USER (payruns & payslips)** | | | |
| P3-0 | ⛔ Payroll schema intake (or provisional-schema decision) | S | — | ✅ |
| P3-1 | Migration: payroll tables + remaining role enum values | M | P3-0 | ✅ |
| P3-2 | Permissions for HR_PAYROLL_USER | S | P3-1 | ✅ |
| P3-3 | Salary structures + rules (read) modules | M | P3-2 | ✅ |
| P3-4 | Rule engine + safe formula evaluator + unit tests | L | P3-3 | ✅ |
| P3-5 | Payruns: eligibility, wizard create, lifecycle, warnings | L | P3-4 | ✅ |
| P3-6 | Payslips + PDF | M | P3-5 | ✅ |
| P3-7 | Send payslips (SMTP, dev transport) | M | P3-6 | ✅ |
| P3-8 | Payroll seed + smoke extensions | M | P3-6 | ✅ |
| P3-9 | UI payruns list + two-step wizard | L | P3-5, FE-6 | ✅ |
| P3-10 | UI payrun detail: actions, warnings, payslips | M | P3-9 | ✅ |
| P3-11 | UI payslips list + payslip detail + print | M | P3-6, P3-10 | ✅ |
| P3-12 | UI salary structures / rules (read-only) | S | P3-3 | ✅ |
| **P4** | **Phase 4 — ④ HR_PAYROLL_MANAGER (config + dashboard)** | | | |
| P4-1 | Role + config-write permissions | S | P3-2 | ✅ |
| P4-2 | Structures & rules write endpoints | M | P4-1 | ✅ |
| P4-3 | Payrun / payslip delete + cancel | S | P4-1 | ✅ |
| P4-4 | Payroll dashboard aggregate endpoint | L | P3-6 | ✅ |
| P4-5 | UI structures & rules editors | M | P4-2, P3-12 | ✅ |
| P4-6 | UI payroll dashboard (KPIs, charts, alerts) | L | P4-4 | ✅ |
| P4-7 | Smoke: config-write boundaries | S | P4-2 | ✅ |
| **P5** | **Phase 5 — ⑤ ADMIN** | | | |
| P5-1 | ADMIN role, all permissions, admin scoping, seed admin | M | P3-1 | ❌ |
| P5-2 | Re-home `users:manage`; permission-matrix endpoint | S | P5-1 | ❌ |
| P5-3 | UI user management | M | P5-2, P2-10 | ❌ |
| P5-4 | UI roles & permissions matrix | S | P5-2 | ❌ |
| P5-5 | Smoke: admin boundaries | S | P5-2 | ❌ |
| **P6** | **Deliverables & hardening** | | | |
| P6-1 | Rule tests for HR + payroll services | M | P0-3 | ❌ |
| P6-2 | OpenAPI / request collection | M | P3-6 | ❌ |
| P6-3 | Representative dataset (HR + payroll) | M | P3-8 | ❌ |
| P6-4 | Demo script (scenario A + B) | M | P3-11 | ❌ |
| P6-5 | Deployment: Docker API + MySQL, hosted frontend | M | P6-3 | ❌ |
| P6-6 | Roadmap summary (PDF deliverable 3) | S | — | ❌ |

**Parallel tracks.** P0, FE and Phases 1–4 are complete. The next executable step is P5-1; the payroll schema remains provisional and must be reconciled with authoritative Phase 3/4 SQL when supplied. ADMIN remains permission-empty and unreleased until Phase 5.

---

# Phase 0 — Foundation & DX

### P0-1 — Align npm scripts and README · S · needs —

- **Goal** every command the README documents actually exists, and `build` regenerates the Prisma client.
- **Files** `ts-backend/package.json`, `ts-backend/README.md`
- **Do** add `typecheck: tsc --noEmit`, `prisma:generate: prisma generate`, `prisma:migrate: prisma
  migrate dev`, `prisma:deploy: prisma migrate deploy`, `prisma:seed: prisma db seed` (the seed hook is
  already wired in `prisma.config.ts`), `test: vitest run`, `test:watch: vitest`, `smoke: tsx
  scripts/smoke.ts`, `db:ephemeral: tsx scripts/ephemeral-db.ts --serve`; change `build` to
  `prisma generate && tsc`. In the README replace "Prisma 7" with "Prisma 6.19.3 (pinned — do not
  upgrade mid-hackathon)".
- **Done when** `npm run typecheck` exits 0 and every command in the README's Setup and Scripts tables
  resolves to a real script.
- ✅ **Done 2026-09-05.** All 12 scripts exist (`dev build start typecheck prisma:generate prisma:migrate
  prisma:deploy prisma:seed test test:watch smoke db:ephemeral`), `build` is `prisma generate && tsc`,
  `npm run typecheck` exits 0. README now says "Prisma 6.19.3 (pinned)" and its Setup + Scripts tables
  use the scripts instead of raw `npx tsx …`. **Beyond the plan:** `prisma.config.ts` lost its
  config-level `datasource` block and `prisma/schema.prisma` regained `url = env("DATABASE_URL")` —
  the config-level override is Prisma 7 only, so on 6.19.3 every Prisma CLI command was failing to see
  the connection string.

### P0-2 — Database up; migrate, seed and smoke re-verified · S · needs P0-1

- **Goal** a green baseline before any UI work — the smoke suite is the regression net for every phase
  after this one.
- **Files** `ts-backend/.env` (local only, never committed)
- **Do** pick one database — `docker compose up -d`, an existing MySQL 8, or `npm run db:ephemeral` on
  3307 — point `DATABASE_URL` at it, then `npm run prisma:deploy && npm run prisma:seed`, `npm run dev`,
  `npm run smoke`.
- **Done when** `GET /api/v1/health` returns 200 with `database: "up"` and smoke reports 57/57. Record
  which database option you chose in a comment at the top of `.env`.
- ✅ **Done 2026-09-05.** Option chosen: the **ephemeral MySQL 8.4** (`npm run db:ephemeral` on 3307) —
  this machine has neither Docker nor a MySQL server on PATH; the choice and how to swap it for Docker or
  a real MySQL is recorded in the `.env` header comment. `prisma:deploy` + `prisma:seed` ran clean,
  `/health` returned `{"status":"ok","database":"up"}` and `npm run smoke` reported **57/57**. Re-run at
  the end of the FE session: still 57/57, so nothing the frontend did touched the API's behaviour.

### P0-3 — vitest harness + unit tests for the pure rules · M · needs P0-1

- **Goal** lock the arithmetic that payroll will consume, with no database in the loop.
- **Files** `ts-backend/vitest.config.ts`, `src/modules/attendance/derive.test.ts`,
  `src/modules/work-schedules/service.test.ts`, `src/lib/dates.test.ts`, `src/auth/permissions.test.ts`
- **Do** `environment: 'node'`, `include: ['src/**/*.test.ts']`; cover worked / break / overtime / late /
  missing-checkout derivation, weekly-hours math, timezone-aware "today" + ISO weekday, and
  `scopeToEmployee` allow **and** deny.
- **Done when** `npm test` is green and each of those four areas has at least one rejection case, not
  just a happy path. Deferrable to P6-1 if the demo is at risk — don't skip both.
- ✅ **Done 2026-09-05.** `npm test` → **68 tests, 4 files, all passing** in ~0.5 s with no database.
  Rejection cases per area: attendance (second clock-in, clock-out during a break, break-end with no
  break, clock-out with no session, session left open on a past day), schedules (`end ≤ start` yielding a
  non-positive span — the 400 the service raises — and a non-ISO weekday payload yielding no working
  days), dates (a string that is not exactly `YYYY-MM-DD`, a calendar date that does not exist, an
  out-of-range TIME, an unknown timezone), permissions (`scopeToEmployee` refuses an EMPLOYEE reaching for
  another record **and** an HR_MANAGER with no employee id, while letting HR through unrestricted). **Beyond the plan:** the config file is
  `vitest.config.mts`, not `.ts` — this package is CommonJS with `module: NodeNext`, so a `.ts` config's
  `export default` is not loadable; and `src/lib/logger.ts` now skips the pino-pretty transport under
  `NODE_ENV=test`, because that transport runs in a worker thread and kept `vitest run` alive after the
  last assertion. The config pins every env var `src/config/env.ts` validates at import time, so a run
  never depends on a developer's `.env`.

---

# FE — Frontend platform

Everything in P1–P5's UI sits on these six steps. Do them in order; don't start screens early.

### FE-1 — Install the frontend and read the Next.js 16 docs · S · needs —

- **Goal** `frontend/AGENTS.md` forbids writing code before reading the docs shipped inside the package —
  Next 16 changed enough that guessing costs more time than reading.
- **Files** `frontend/node_modules` (install), `docs/frontend-notes.md` (new)
- **Do** `npm install`; `ls node_modules/next/dist/docs/`; read the routing/layouts, data-fetching &
  caching, forms/actions and middleware guides; write `docs/frontend-notes.md` capturing only the deltas
  that affect us (async `params`/`searchParams`, caching defaults, route-group conventions, middleware
  limits) with the doc path beside each, plus any deprecation notices.
- **Done when** `npm run dev` serves the boilerplate on :3000 and the notes file covers at least routing,
  data-fetching/caching and middleware with doc paths.
- ✅ **Done 2026-09-05.** `npm install` (Next 16.3.4, React 19.2.8) and `npm run dev` served :3000.
  `docs/frontend-notes.md` covers routing and layouts, route groups and private folders, data fetching and
  caching, `middleware.ts` → **`proxy.ts`**, styling, deprecations that touch this repo, and housekeeping —
  each section citing the doc path inside `node_modules/next/dist/docs/`. The three findings that shaped
  every later step: one root layout only (a group layout must not render `<html>`/`<body>`), `params` and
  `searchParams` are promises in server components, and `useSearchParams()` in a client component needs a
  `<Suspense>` boundary above it or the whole route leaves the prerender.

### FE-2 — Toolchain: tokens, UI primitives, Query, forms · M · needs FE-1

- **Goal** one styling and data-fetching foundation, installed once.
- **Files** `frontend/app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, `components/ui/*`,
  `lib/utils.ts`
- **Do** install `@tanstack/react-query` (+ devtools), `react-hook-form`, `zod`, `@hookform/resolvers`,
  `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `date-fns`; try
  `npx shadcn@latest init` — if it doesn't support Next 16 / Tailwind 4 yet, hand-roll the same primitives
  (button, input, select, dialog, popover, table, badge, tabs, toast) under `components/ui`; define colour
  and spacing tokens in Tailwind 4's `@theme`; wrap the tree in `QueryClientProvider` (staleTime 30 s,
  retry 1) plus a toaster.
- **Done when** `npm run build` and `npm run lint` pass and a scratch page renders Button, Input, Dialog
  and Table with tokens applied in both light and dark.
- ✅ **Done 2026-09-05.** `npx shadcn@latest init` **did** support Next 16 + Tailwind 4 (shadcn 4.21.0,
  `radix-nova` style, `components.json` committed), so the primitives are generated rather than hand-rolled:
  badge, button, card, checkbox, dialog, dropdown-menu, input, label, popover, select, separator, skeleton,
  sonner, table, tabs, textarea. Installed exactly as listed plus `radix-ui`, `next-themes`, `sonner`,
  `tw-animate-css`, and `cn` — that last one is shadcn's own class-merge helper, which `lib/utils.ts`
  re-exports so callers still `import { cn } from "@/lib/utils"`. Tokens live in `app/globals.css` under
  Tailwind 4's `@theme` (colour, radius, the `topbar`/`content` sizes the shell uses), `app/providers.tsx`
  holds `QueryClientProvider` (staleTime 30 s, retry 1) + devtools + `next-themes` + the toaster. Gate:
  `/scratch` renders every primitive, `ThemeToggle` flips light/dark, `npm run build` and `npm run lint`
  clean.

### FE-3 — Typed API client, session and route guard · L · needs FE-2

- **Goal** every screen after this calls `useQuery(api.employees.list(…))` and never touches `fetch`,
  tokens or refresh logic.
- **Files** `frontend/lib/api/client.ts`, `lib/api/types.ts`, `lib/api/<module>.ts`,
  `lib/auth/session.tsx`, `hooks/use-can.ts`, `app/(auth)/login/page.tsx`, `.env.local`
- **Do** `client.ts`: base URL from `NEXT_PUBLIC_API_URL`, `credentials: 'include'`, JSON in/out, an
  `ApiError { status, code, message, details }`; hold the access token **in memory only**; on 401 run a
  *single-flight* `POST /auth/refresh` then retry the request once; on refresh failure clear the session
  and redirect to `/login`. On app load bootstrap with `/auth/refresh` (the cookie survives a reload, the
  in-memory token doesn't) then `/auth/me`. `types.ts` hand-mirrors the backend response shapes;
  `SessionProvider` exposes `user`, `permissions`, `can(p)`; the `(app)` layout redirects anonymous users.
- **Done when** login works for `hr.manager` and for an employee's work email, a hard reload keeps the
  session, and with `JWT_ACCESS_TTL_MINUTES=1` a stale request refreshes and retries transparently
  (confirm the 401 → refresh → retry trio in the network panel).
- ✅ **Done 2026-09-05.** Built: `lib/api/{client,types,index,employees,departments,attendance}.ts`,
  `lib/auth/session.tsx`, `hooks/use-can.ts`, `components/auth/require-session.tsx`,
  `app/(auth)/{layout.tsx,login/page.tsx}`, `frontend/.env.example` (`NEXT_PUBLIC_API_URL`; `.env.local`
  is local-only and stays out of git). `client.ts` holds the access token in a module variable, never in
  storage; a 401 funnels through **one** in-flight `POST /auth/refresh` (a shared promise, so ten parallel
  queries produce one refresh) and each request retries exactly once; a failed refresh clears the session
  and pushes `/login`. Bootstrap is `refresh` → `me`, which is what survives a reload. Each `lib/api`
  module exports query *options* (`api.employees.list(params)`) plus a `*Keys` factory, so screens call
  `useQuery(api.…)` and invalidate by key. `ApiError` carries `{ status, code, message, details }` and its
  `fieldErrors(fields)` is what FE-6's forms consume. **Machine-verified:** typecheck, lint and
  `npm run build` clean. **Human click-through still owed:** the two logins, the hard reload, and the
  401 → refresh → retry trio in the network panel with `JWT_ACCESS_TTL_MINUTES=1`.

### FE-4 — App shell: role-aware nav and header · M · needs FE-3

- **Goal** the mockup's chrome, with menus driven by `permissions` instead of hardcoded roles.
- **Files** `frontend/app/(app)/layout.tsx`, `components/shell/{sidebar,topbar,nav-config}.tsx`,
  `components/forbidden.tsx`, `app/not-found.tsx`
- **Do** declare the nav as data — `HR | Employees ▾ (Employees, Contracts, Departments, Working
  Schedules) | Attendance | Time Off ▾ (Dashboard, Requests, Allocations, Types) | Payroll ▾ (empty until
  P3)` — each entry naming the permission it requires; hide what `can()` rejects; topbar with user name,
  role chip, logout and a slot for the attendance widget; render a readable 403 screen whenever
  `ApiError.status === 403`.
- **Done when** HR sees the full menu, an employee sees only My Space / Attendance / Time Off / own
  contracts, typing `/departments` as an employee lands on the 403 screen, and logout clears both the
  in-memory token and the refresh cookie.
- ✅ **Done 2026-09-05.** `app/(app)/layout.tsx` (anonymous → `/login`), `components/shell/sidebar.tsx`,
  `topbar.tsx` (user name, role chip, theme toggle, logout, and the slot FE-5's widget fills),
  `components/forbidden.tsx` (`isForbidden`, `Forbidden`, `RequirePermission`), `app/not-found.tsx`,
  `app/(app)/error.tsx`. The nav is data in `components/shell/nav-config.ts` — **`.ts`, not `.tsx`**, since
  it is a table, not markup — with a `permission` per entry: Employees on `employees:write`, Departments on
  `departments:write`, Working Schedules on `work-schedules:write`, Types on `leave-types:write`, while
  Contracts / Attendance / Time Off / Allocations sit on their `*:read` permission because the API
  row-scopes those for an employee instead of refusing them. Payroll is declared with an empty child list
  until P3. **Beyond the plan:** nine `StepPlaceholder` route stubs (`/employees`, `/contracts`,
  `/departments`, `/work-schedules`, `/attendance`, `/time-off`, `/time-off/requests`,
  `/time-off/balances`, `/time-off/types`) each naming the step that will replace it — without them the
  gate's "type `/departments` as an employee" lands on 404 instead of the 403 screen — plus
  `components/shell/step-placeholder.tsx`, `components/theme-toggle.tsx`, and an `(app)/page.tsx` landing
  card reading `GET /employees/me/summary` until P1-1 replaces it. **Human click-through still owed:** the
  HR-vs-employee menu diff, `/departments` as an employee, and logout.

### FE-5 — Attendance widget · M · needs FE-4

- **Goal** the header punch control from the mockup, on top of the finished punch API.
- **Files** `frontend/components/attendance/widget.tsx`, `lib/api/attendance.ts`
- **Do** read `GET /attendance/session`; show Check In when there's no open session, otherwise Check Out
  with a live elapsed timer; break start/end while a session is open; green status dot while open;
  invalidate attendance queries after every punch; surface the API's 422 text verbatim.
- **Done when** clock-in → break-start → break-end → clock-out completes from the header, today's row in
  `/attendance` shows matching worked and break hours, and a second clock-in shows the 422 message.
- ✅ **Done 2026-09-05.** `components/attendance/widget.tsx` + `lib/api/attendance.ts`: reads
  `GET /attendance/session` and derives its buttons from `state`, with one deliberate exception — Check Out
  stays live during a break, because the API answers that with "End your break before clocking out", which
  is more use than a disabled button. A live elapsed timer pauses while a break is open, a green dot marks
  an open session, every punch invalidates the attendance keys, and each 422 is rendered in the server's own
  wording. The widget is gated on `attendance:punch`, so it simply does not query for a session it cannot
  create. **Gate run (33/33 PASS, script driving the same endpoints the widget
  calls, as the seeded employee `john.dsouza@oxp.com`):** OUT → clock-in → 201/state IN → second clock-in
  **422 "You are already clocked in"** → break-end with no break 422 → break-start → clock-out during a
  break 422 → elapsed frozen while ON_BREAK → break-end → clock-out → worked 0.02 h / break 0.01 h, and
  `GET /attendance/records?date=today` returns exactly one row whose worked and break hours match the
  widget's, holding all four punches with `source=WEB` and status `PRESENT`. **Deviation:** the gate says
  "today's row in `/attendance`", but that screen is still a `StepPlaceholder` (it is **P1-3**), so the row
  was verified through `GET /attendance/records` instead of the list UI. **Human click-through still
  owed:** the punch sequence from the header, and a second clock-in from a second tab to see the 422 in
  the widget.

### FE-6 — Shared list and form primitives · M · needs FE-4

- **Goal** one table and one form implementation for ~20 screens, matching `{ data, meta }` exactly.
- **Files** `frontend/components/data-table.tsx`, `components/filter-bar.tsx`,
  `components/pagination.tsx`, `components/page-header.tsx`, `components/status-badge.tsx`,
  `components/kanban.tsx`, `components/form/*`
- **Do** `DataTable` takes columns + a query result and syncs `page/pageSize/sort/order/q` to the URL;
  `FilterBar` renders module filters declaratively; form `<Field>` wrappers bind RHF + zod and map
  `ApiError.details` onto fields with 409/422 into a form banner; skeleton, empty and error-retry states;
  a generic grouped-column Kanban for P2-1.
- **Done when** a scratch page lists `/employees` with working search, sort, paging and URL round-trip,
  and a deliberately duplicate department shows the server's message on the name field.
- ✅ **Done 2026-09-05.** Built `hooks/use-list-params.ts` (**new file, not in the list above** — the URL
  is the single source of list state, so table, filter bar, pager and kanban all read one hook rather than
  each holding their own `useState`), `components/data-table.tsx` (columns + a structural `TableQuery<T>`,
  sortable headers with `aria-sort`, `hideBelow` responsive columns, skeleton / empty / error-retry states,
  an exported `ListError` the kanban reuses), `components/filter-bar.tsx` (declarative `select | date |
  text` filters plus search), `components/pagination.tsx` (rows-per-page, an `aria-live` "21–40 of 57"
  readout, first/prev/next/last), `components/kanban.tsx` (declared groups, so an empty department still
  renders a column), and `components/form/{use-api-form.ts,field.tsx,form.tsx,index.ts}` —
  `useApiForm` maps a 400's `details` onto fields by path, a 409's index name back onto the field it
  belongs to (`departments_department_name_key` → `departmentName`) and puts 409/422 text in the banner,
  focusing the first field the server objected to. `page/pageSize/sort/order/q` and module filters live in
  the query string; defaults are pruned so a clean list has a clean URL, and any change except paging
  returns to page 1. **Machine-verified:** `npx tsc --noEmit`, `npm run lint` and `npm run build` all
  clean, with `/scratch/lists` prerendering static behind its `<Suspense>` boundary. **Human
  click-through still owed:** `/scratch/lists` — search, sort a column, page, reload and use Back, then
  submit the pre-filled duplicate `Engineering` to see the 409 on the name field and in the banner.

---

# Phase 1 — ① EMPLOYEE screens

Backend for all of these is done; every step is UI plus an `lib/api` module. Verify each as the seeded
employee (`aarav.mehta@oxp.com`), then re-check as HR that nothing broke.

### P1-1 — My Space dashboard (`/`) · M · needs FE-5, FE-6

- **Goal** the EMPLOYEE landing screen; HR lands on `/employees` instead.
- **Files** `app/(app)/page.tsx`, `components/dashboard/*`
- **Do** cards from `/employees/me`, `/employees/me/summary`, `/employees/me/schedule`,
  `/leave-balances/me`, today's `/attendance/session` plus the last 7 days of `/attendance/records`, and
  my latest `/time-off/requests`; quick actions for punch and request-time-off; if `can('employees:write')`
  redirect to `/employees`.
- **Done when** an employee login shows only own data with no failed request in the console, and an HR
  login redirects.

### P1-2 — My profile · S · needs FE-6

- **Goal** the employee reads their own record in the mockup's layout, with no edit affordances.
- **Files** `app/(app)/employees/me/page.tsx`, `components/employees/employee-details.tsx`
- **Do** header (name, job title • department, email | phone), tabs *Work Information* /
  *Private Information*, smart-button counts from `/employees/me/summary` linking to own filtered lists.
  Build `employee-details.tsx` with a `readOnly` prop — **P2-2 reuses this component in edit mode**.
- **Done when** it renders read-only for an employee and the same component later mounts editable without
  a fork.

### P1-3 — My attendance · M · needs FE-6

- **Files** `app/(app)/attendance/page.tsx`, `attendance/[id]/page.tsx`, `components/attendance/*`
- **Do** list own records — date, first in, last out, worked, break, expected, overtime, status, plus
  late / missing-checkout flags — with date-range and status filters and a Today shortcut; the day detail
  shows the punches read-only; hide all edit controls behind `can('attendance:write')`.
- **Done when** the employee sees only own rows, the derived columns agree with the widget's day, and
  deep-linking another employee's record id renders 403.

### P1-4 — My time off · L · needs FE-6

- **Files** `app/(app)/time-off/page.tsx`, `time-off/requests/page.tsx`, `requests/[id]/page.tsx`,
  a new-request dialog, `lib/api/time-off.ts`
- **Do** dashboard (my balances with remaining / pending / available, upcoming leave, my pending
  requests); request list with status badges; create form (type, dates, reason) that shows the
  service-computed `total_days` on success and renders 409 overlap and 422 insufficient-balance inline;
  edit while PENDING; cancel own PENDING request only.
- **Done when** a request from the seeded employee is submitted, overlap and shortfall messages are
  readable, and cancelling an APPROVED request is not offered to the employee (that path is HR's, P2-6).

### P1-5 — My balances and my contracts · S · needs FE-6

- **Files** `app/(app)/time-off/balances/page.tsx`, `app/(app)/contracts/page.tsx` (+ `[id]`)
- **Do** balances table (type, year, allocated, carried forward, used, remaining, pending, available) —
  remaining and available are API-derived, never inputs; contracts list scoped to self with the ACTIVE row
  highlighted and a read-only detail.
- **Done when** both screens render for an employee with no write buttons, and the same routes gain HR
  controls in P2-3 / P2-7 without duplication.

---

# Phase 2 — ② HR_MANAGER screens

Order follows the mockup's nav so the demo becomes clickable earliest. Verify each as `hr.manager`, then
re-check the employee view from Phase 1 still scopes correctly.

### P2-1 — Employees kanban + list · L · needs FE-6

- **Files** `app/(app)/employees/page.tsx`, `components/employees/{kanban,list,filters}.tsx`
- **Do** Kanban as the default view (columns = department, cards = avatar placeholder, name, job title,
  status badge), a list toggle persisted in the URL, filters `q` / department / status / manager, and a
  "New Employee" action behind `employees:write`.
- **Done when** HR sees all seeded employees in both views, filters and paging round-trip through the URL,
  and an employee hitting `/employees` gets 403 (their record lives at `/employees/me`).

### P2-2 — Employee form · L · needs P2-1

- **Files** `app/(app)/employees/[id]/page.tsx`, `employees/new/page.tsx`, reusing
  `components/employees/employee-details.tsx` from P1-2
- **Do** create and edit with *Work Information* (department, job title, manager, hire date, status,
  current schedule) and *Private Information* (date of birth, phone, address, email); smart buttons
  Contracts / Attendance / Time Off / Allocations with counts from `/employees/:id/summary`, each
  deep-linking to that list pre-filtered; Terminate (`POST /employees/:id/terminate`) and Delete with a
  cascade warning.
- **Done when** create → edit → terminate → delete round-trips, a duplicate email shows the 409 on the
  email field, and picking the employee as their own manager shows the API's rejection.

### P2-3 — Contracts (HR) · M · needs P2-2

- **Files** `app/(app)/contracts/*` (extends P1-5)
- **Do** list with filters employee / status / contractType / activeOn, ACTIVE row highlighted, salary
  formatted in the contract's own currency; create and edit (type, dates, base salary, currency defaulting
  from the API, document URL); Terminate action; show auto-EXPIRED rows as expired.
- **Done when** a second overlapping ACTIVE contract shows the 409 on the date fields, terminate flips the
  status, and the employee's read-only view still works.

### P2-4 — Working schedules + assignments · M · needs P2-2

- **Files** `app/(app)/work-schedules/*`, `components/schedules/assignment-history.tsx`
- **Do** list (name, days/week, weekly hours); form with weekday checkboxes and start/end time where
  **weekly hours is displayed as derived and never editable**; per-employee assignment history with
  effective-from/to plus an Assign action reachable from the employee form.
- **Done when** saving shows the recomputed weekly hours, `end ≤ start` shows the 400, and an overlapping
  assignment shows the 409.

### P2-5 — Attendance (HR) · L · needs P1-3

- **Files** extend `app/(app)/attendance/*`
- **Do** employee / date-range / status filters plus a Today shortcut; manual record create; day form with
  punch add / edit / delete (the API stamps `source = MANUAL`) and a visible source column; a
  "Mark absences" action for a chosen date that summarises the idempotent result.
- **Done when** an HR punch edit changes the derived worked hours on reload, an invalid punch sequence
  shows the 422, and running mark-absences twice reports no duplicates.

### P2-6 — Time off decisions · M · needs P1-4

- **Files** extend `app/(app)/time-off/requests/*`
- **Do** cross-employee list with status filter and inline Approve / Reject (comment dialog); detail shows
  the decision panel and the approval record from `GET /time-off/requests/:id/approval`; cancel PENDING or
  APPROVED behind a confirm.
- **Done when** approving increments `used_days` on the balances screen, rejecting doesn't, cancelling an
  APPROVED request restores the balance, and an employee attempting a decision gets 403.

### P2-7 — Allocations (leave balances, HR) · M · needs P1-4

- **Files** extend `app/(app)/time-off/balances/*`
- **Do** cross-employee list with employee / type / year filters; create and edit rows; an
  **Initialize year** action (`POST /leave-balances/initialize`, year + carry-forward toggle) and a
  **Recompute** action that reports the drift it found; remaining and available stay read-only.
- **Done when** initialize only creates rows for employees missing them, editing allocated updates
  remaining immediately, and recompute reports zero drift on seeded data.

### P2-8 — Time off types · S · needs FE-6

- **Files** `app/(app)/time-off/types/*`
- **Do** list (name, default annual days, description) and form; help text stating that
  `default_annual_days = 0` means the type is not balance-tracked (e.g. Unpaid); delete surfaces the API's
  422 business-rule message when the type is referenced.
- **Done when** create / edit / delete round-trip and a type in use shows the 422 message.

### P2-9 — Departments · S · needs FE-6

- **Files** `app/(app)/departments/*`
- **Do** list plus create / edit / delete; duplicate name → 409 on the name field.
- **Done when** CRUD round-trips and the duplicate case reads clearly.

### P2-10 — Users (HR) · M · needs FE-6

- **Files** `app/(app)/users/*`
- **Do** list (user, linked employee, role, active, last login) with `q` and role filter; create form
  (employee picker, username defaulting to the work email, password, role from `GET /roles`); edit role /
  active; hide role and active controls on the acting user's own row (the API also refuses).
- **Done when** a created login authenticates against `POST /auth/login`, self-role-change and
  self-deactivation controls are not offered, and deactivation blocks future login/refresh. Existing access
  tokens remain valid until expiry because the backend does not perform per-request revocation checks.

---

# Phase 3 — ③ HR_PAYROLL_USER (payruns & payslips)

Access: everything HR_MANAGER has, **plus** create / read / update on payruns and payslips and
**read-only** salary structures and rules. No payroll deletes, no config edits (those are Phase 4).

### P3-0 — ⛔ Payroll schema intake · S · needs —

- **Goal** Phases 3–5 cannot start without payroll tables. This step ends with either the team's SQL in
  hand or a written decision to proceed without it.
- **Do** ask the team for the Phase 3 **and** 4 SQL together — payslips can't compute without structures
  and rules (overall plan §5). Confirm: role names, whether the salary structure hangs off the payrun or
  the contract (open decision §8 #6), and whether bank details arrive as `employee_bank_details` (§8 #8).
  If the SQL isn't available, take the default: build from the placeholder in overall plan §4.3, keep
  **every** payroll table in one migration so it can be replaced wholesale, and record every deviation.
- **Done when** `docs/phase-3-plan.md` exists with the phase's tables, rules, API surface and screens, and
  states which of the two paths was taken and why.

### P3-1 — Payroll migration + role enum values · M · needs P3-0

- **Files** `ts-backend/prisma/schema.prisma`, a new migration, `prisma/seed.ts`
- **Do** add `salary_structures`, `salary_rules` (name, unique code, category, sequence, computation
  method, amount / percent / formula, base, active), the structure↔rule link, `payruns`, `payslips`,
  `payslip_lines`, `employee_bank_details`. Translate types with the rules in phase-1-plan §4.1 —
  `Decimal(12,2)` for money, Prisma enums instead of CHECK, JSON where MySQL lacks arrays. Add **all three**
  remaining `RoleName` values (`HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN`) in this single migration:
  three separate enum migrations buy nothing and permissions still gate access (deliberate deviation from
  overall plan §8 #3). Seed the role rows idempotently.
- **Done when** `npx prisma migrate dev --name phase_3_payroll` applies on a fresh database, the seed is
  still idempotent, `npm run typecheck` exits 0, and the existing 57 smoke checks still pass.

### P3-2 — Permissions for HR_PAYROLL_USER · S · needs P3-1

- **Files** `src/auth/permissions.ts`
- **Do** add `payroll:read`, `payruns:write`, `payslips:write`, `salary-config:read`; build the role as
  HR_MANAGER's set **plus** those; include it in `canSeeAllEmployees()`; leave HR_MANAGER with no
  `payroll:*`.
- **Done when** `GET /auth/me` for the new role lists the superset, HR_MANAGER gets 403 on a payroll route,
  and EMPLOYEE scoping is unchanged.

### P3-3 — Salary structures & rules (read) · M · needs P3-2

- **Files** `src/modules/salary-structures/{router,schema,service}.ts`, `src/modules/salary-rules/*`,
  `src/routes.ts`
- **Do** `GET /salary-structures`, `GET /salary-structures/:id` (with its rules in sequence),
  `GET /salary-rules` (filters structureId, category, active). Same list conventions, validation and error
  envelope as every other module. No write endpoints yet — Phase 4 adds them.
- **Done when** both lists paginate and sort, the detail returns rules ordered by sequence, and there is no
  unguarded write route.

### P3-4 — Rule engine · L · needs P3-3

- **Files** `src/modules/payroll/engine.ts`, `engine.test.ts`
- **Do** execute a structure's rules in sequence over an input context (contract wage, worked days/hours,
  expected days, unpaid days, currency). Support Fixed amount, Percentage of a named base (contract wage /
  BASIC / GROSS) and Formula. **No `eval`** — hand-write a small recursive-descent parser over numbers,
  `+ - * / ( )`, `min` / `max` / `round` and identifiers resolved from `categories[…]`, `rules[…]` and
  inputs; reject everything else. Accumulate per-category totals and return lines (rule, code, category,
  sequence, amount) plus Basic / Allowances / Deductions / Gross / Net, rounded to 2 decimals.
- **Done when** unit tests cover a fixed rule, a percentage-of-basic rule, a formula over an earlier
  category, a rule referencing a *later* sequence (rejected), a hostile formula string (rejected) and
  rounding.

### P3-5 — Payruns module · L · needs P3-4

- **Files** `src/modules/payruns/*`
- **Do** `GET /payruns`, `GET /payruns/:id`. Wizard **step 2 is a read**:
  `GET /payruns/eligible-employees?structureId&from&to&contractType` returns ACTIVE employees with an
  active contract at period end, *flagging* (not hiding) anyone already on a payslip for an overlapping
  period. `POST /payruns { name, structureId, periodStart, periodEnd, employeeIds[] }` creates the DRAFT
  and payslip shells for the selected employees only. `POST /payruns/:id/compute` (DRAFT or COMPUTED only)
  runs the engine per payslip in one transaction, replacing lines. `GET /payruns/:id/warnings`;
  `POST /payruns/:id/validate` (blocks on hard warnings) and `/mark-paid` (stamps the paid date);
  VALIDATED/PAID reject further compute or edits; `POST /payruns/:id/cancel`.
- **Do (inputs)** derive worked days/hours from attendance + the resolved schedule for the period, and
  unpaid days from approved requests of untracked leave types. Reuse `getActiveContract`, `getScheduleFor`
  and `attendance/derive.ts` — do not re-implement any of it (overall plan §3).
- **Done when** out-of-order transitions return 422, computing twice yields identical totals, and a payrun
  created from a 3-employee selection has exactly 3 payslips.

### P3-6 — Payslips + PDF · M · needs P3-5

- **Files** `src/modules/payslips/*`, `src/modules/payroll/pdf.ts`
- **Do** `GET /payslips` (filters employeeId, payrunId, period, status), `GET /payslips/:id` with lines
  grouped by category plus totals, `POST /payslips/:id/recompute` (only while the payrun is DRAFT or
  COMPUTED), `GET /payslips/:id/pdf` streaming the document (pdfkit or @react-pdf): identification block,
  computation table, totals. Route reads through `scopeToEmployee()` so employee self-service is later a
  permission flip — 📝 not in this phase's scope.
- **Done when** the PDF opens for a computed payslip showing employee, period, structure, every line and
  Gross/Net; recompute against a PAID payrun returns 422.

### P3-7 — Send payslips · M · needs P3-6

- **Files** `src/modules/payroll/mailer.ts`, `src/config/env.ts`, `.env.example`
- **Do** add optional `SMTP_*` and `MAIL_FROM` to the validated env; nodemailer transport with a dev
  fallback (Ethereal or a console transport) so the demo never needs real SMTP;
  `POST /payruns/:id/send-payslips` attaches each PDF, emails the employee's work email, VALIDATED/PAID
  only, and returns a per-employee result.
- **Done when** the endpoint returns a per-recipient report on the dev transport, a DRAFT payrun is
  rejected with 422, and missing SMTP config degrades to the console transport instead of failing boot.

### P3-8 — Payroll seed + smoke · M · needs P3-6

- **Files** `prisma/seed.ts`, `scripts/smoke.ts`
- **Do** seed one "Regular Salary" structure with Basic, HRA, Standard Allowance, PF, Professional Tax,
  ESIC, Gross, Net in sequence, bank details for most employees, and one computed payrun for last month —
  all behind the existing "only when empty" guard. Extend smoke with eligibility, create-from-selection,
  compute totals, every transition guard, warnings, and HR_MANAGER 403s on payroll.
- **Done when** a fresh `prisma:deploy && prisma:seed` produces a computed payrun and smoke passes with the
  new checks (total > 57, printed by the script).

### P3-9 — UI payruns list + wizard · L · needs P3-5, FE-6

- **Files** `app/(app)/payroll/payruns/page.tsx`, `components/payroll/new-payrun-wizard.tsx`
- **Do** list (name, structure, period, status, payslip count, search). Wizard **step 1** = scope
  (structure, period from/to or month, contract-type filter) where Continue only *fetches*; **step 2** =
  eligible-employee multi-select showing the duplicate / no-contract flags; **Create Payrun** posts once
  with the selected ids and routes to the new payrun.
- **Done when** abandoning the wizard creates nothing (confirm no row was written) and deselecting an
  employee in step 2 excludes their payslip.

### P3-10 — UI payrun detail · M · needs P3-9

- **Files** `app/(app)/payroll/payruns/[id]/page.tsx`
- **Do** header (name, structure, period, status chip); action bar COMPUTE → VALIDATE → MARK PAID → SEND
  PAYSLIPS with each button disabled by status *and* permission; warnings panel split hard / soft; payslip
  table with per-employee gross and net; per-payslip recompute while draft.
- **Done when** the four actions drive the whole lifecycle from the UI and no button is offered that the
  API would refuse.

### P3-11 — UI payslips + print · M · needs P3-6, P3-10

- **Files** `app/(app)/payroll/payslips/page.tsx`, `payslips/[id]/page.tsx`
- **Do** list (employee, structure, payrun, period, status, worked days) with search and period filter;
  detail with the identification block and the **Salary Computation** table (rule, category, amount)
  subtotalled Basic / Allowances / Deductions / Gross / Net; **PRINT PAYSLIP** opens
  `GET /payslips/:id/pdf`.
- **Done when** the table's Net matches the API's and the PDF downloads for the seeded payrun.

### P3-12 — UI salary structures & rules (read-only) · S · needs P3-3

- **Files** `app/(app)/payroll/structures/page.tsx` + `[id]`, `app/(app)/payroll/rules/page.tsx`
- **Do** structure list (name, rule count, active) and detail listing rules in sequence with category and a
  one-line computation summary; rules list with structure and sequence. No edit affordances for this role —
  take an `editable` prop that P4-5 turns on behind `salary-config:write`.
- **Done when** HR_PAYROLL_USER sees both screens read-only and the components are ready for P4-5 without a
  rewrite.

### Phase 3 completion evidence — 2026-09-05

| Step | Verified result |
|---|---|
| P3-0 | ✅ `docs/phase-3-plan.md` records the explicit provisional path, complete schema/rule/API/screen contract, and reconciliation requirement; authoritative team SQL is still pending. |
| P3-1 | ✅ One isolated additive migration added all six payroll tables and all remaining role literals. Fresh MySQL 8.4.9 applied both migrations, exposed 20 application tables plus `_prisma_migrations`, and the seed passed twice idempotently. |
| P3-2 | ✅ Unit and 84/84 live smoke checks prove `HR_PAYROLL_USER` is the HR superset, `HR_MANAGER`/`EMPLOYEE` receive payroll 403s, and unreleased roles remain permission-empty/unassignable. |
| P3-3 | ✅ Salary structure/rule read lists and ordered detail passed live smoke; no configuration write routes exist. |
| P3-4 | ✅ The bounded non-`eval` decimal engine is included in the **81/81** passing unit suite, covering fixed, percentage, formula, reference ordering, hostile input, and rounding. |
| P3-5 | ✅ Live smoke verified flagged/nonselectable duplicates, selected-only creation, idempotent compute, warning split, lifecycle order, paid immutability, and cancellation. |
| P3-6 | ✅ Live smoke verified scoped payslip list/detail, mutable recompute, PAID rejection, and an `application/pdf` response beginning `%PDF`. |
| P3-7 | ✅ VALIDATED/PAID sending returns per-recipient results; absent SMTP uses Nodemailer's deterministic offline JSON transport (the implemented dev fallback rather than Ethereal/console). |
| P3-8 | ✅ Fresh seed created Regular Salary with eight ordered rules, bank-warning data, payroll login, and prior-month computed history; its second run was idempotent and smoke finished **84/84**. |
| P3-9 | ✅ Typed URL-backed payrun list and two-step selected-employee wizard compile, lint, and build; smoke proves the selected-only/no-write-before-create API contract. |
| P3-10 | ✅ Dynamic detail, hard/soft warnings, lifecycle/send/cancel controls, and mutable payslip recompute are status- and permission-gated; all payroll routes were emitted by the production build. |
| P3-11 | ✅ Scoped payslip list/detail and authenticated refresh-aware PDF print/download passed typecheck, lint, build, and PDF API smoke. |
| P3-12 | ✅ Read-only structure/rule lists and detail use `editable={false}` and passed the production gate. |

No browser-only manual click-through was recorded; the UI evidence is TypeScript, ESLint, route generation/production build, and the corresponding live API workflows.

---

# Phase 4 — ④ HR_PAYROLL_MANAGER (payroll configuration + dashboard)

Access: everything HR_PAYROLL_USER has, plus write on payroll config and delete on payroll records.

### P4-1 — Role + config-write permissions · S · needs P3-2

- **Files** `src/auth/permissions.ts`, `prisma/seed.ts`
- **Do** add `salary-config:write`, `payruns:delete`, `payslips:delete`; role = HR_PAYROLL_USER's set plus
  those; seed the role and one demo login (documented in the README).
- **Done when** `/auth/me` shows the superset and HR_PAYROLL_USER gets 403 on a config write.

### P4-2 — Structures & rules write endpoints · M · needs P4-1

- **Files** `src/modules/salary-structures/*`, `src/modules/salary-rules/*`
- **Do** POST / PATCH / DELETE for both; sequence unique within a structure (409); rule code unique;
  **deactivate instead of delete** when referenced by any payslip line or payrun (422 with the reference
  count); editing a rule must never touch historic payslip lines — they store computed amounts.
- **Done when** editing a rule used by a PAID payslip leaves that payslip's numbers unchanged (asserted in
  smoke), duplicate sequence returns 409, and a referenced delete returns 422 pointing at deactivation.

### P4-3 — Payrun / payslip delete + cancel · S · needs P4-1

- **Do** DELETE limited to DRAFT (payrun plus its payslips and lines); CANCEL for later states, preserving
  history; PAID stays immutable.
- **Done when** deleting a DRAFT removes its payslips, deleting a VALIDATED or PAID payrun returns 422, and
  cancel keeps the row with a cancelled status.

### P4-4 — Payroll dashboard aggregates · L · needs P3-6

- **Files** `src/modules/dashboard/*`
- **Do** `GET /dashboard/payroll?from&to&departmentId&contractType` returning: KPIs (total net paid,
  payslips generated split paid / pending, average salary per employee, approved time-off days, attendance
  health), salary cost by department, monthly net trend, alerts (missing bank details, duplicate payslips,
  drafts not validated, contracts expiring), attendance overview (present, late, absent, overtime hours,
  missing check-outs, manual edits), time-off overview and department breakdown. Live queries only, filters
  applied uniformly to every figure, nothing cached.
- **Done when** two figures picked at random reproduce from a hand-written query on the seeded data, and the
  whole dashboard is one round trip.

### P4-5 — UI structures & rules editors · M · needs P4-2, P3-12

- **Do** turn on `editable` from P3-12; structure form with an ordered rule list (visible sequence numbers,
  reorder); rule form with category (BASIC / ALLOWANCE / GROSS / DEDUCTION / NET), sequence, computation
  (Fixed · Percentage of base with a base picker · Formula with a hint listing the allowed identifiers) and
  an active toggle; when a delete is refused, offer deactivation in the same dialog.
- **Done when** a new rule shows up in a recomputed payslip while historic payslips keep their old numbers.

### P4-6 — UI payroll dashboard · L · needs P4-4

- **Do** KPI row, *Salary Cost by Department* and *Monthly Net Salary Trend* charts, alerts list linking to
  the offending records, attendance and time-off overviews, department breakdown table, and Period /
  Department / Employee Type filters that apply to every widget. One chart library only; follow the repo's
  dataviz guidance for palette and chart choice.
- **Done when** changing a filter updates every widget and each KPI links to the list that explains it.

### P4-7 — Smoke: config boundaries · S · needs P4-2

- **Do** extend smoke with HR_PAYROLL_USER 403 on structure / rule writes and payrun delete,
  HR_PAYROLL_MANAGER success on the same, and historic-payslip immutability after a rule edit.
- **Done when** smoke passes with the added checks.

### Phase 4 completion evidence

| Step | Verified result |
|---|---|
| P4-1 | ✅ Manager login exposes all 26 released permissions; `HR_PAYROLL_USER` remains read-only for config and cannot hard-delete payroll rows. |
| P4-2 | ✅ Structure/rule create, edit, reorder and delete paths pass; duplicate code/sequence return 409; referenced deletes return 422 with deactivation guidance; paid snapshots remain unchanged after rule edits. |
| P4-3 | ✅ DRAFT payslip/payrun deletion and cascade pass; COMPUTED/VALIDATED cancellation preserves history; VALIDATED, PAID and CANCELLED hard-delete attempts return 422. |
| P4-4 | ✅ One live dashboard response applies common filters. Direct database checks reproduced payslip count **4**, monthly net **394337.50**, average generated salary **98584.38**, and approved time off **4 days** for the checked period. |
| P4-5 | ✅ Permission-derived editors, method-aware rule forms, conflict mapping, atomic reorder and deactivate fallback pass typecheck/lint/build. |
| P4-6 | ✅ `/payroll/dashboard` was emitted by the production build with URL-backed filters, linked KPIs, Recharts charts, alerts and breakdowns. |
| P4-7 | ✅ Fresh-DB end-to-end smoke passed **113/113** checks. |

---

# Phase 5 — ⑤ ADMIN

### P5-1 — ADMIN role · M · needs P3-1

- **Files** `src/auth/permissions.ts`, `prisma/seed.ts`, `src/config/env.ts`, `.env.example`, README
- **Do** `ADMIN` = every permission; include ADMIN in `canSeeAllEmployees()`; seed the first admin from
  `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` (validated env, documented).
- **Done when** the admin login reaches every module's list and `/auth/me` returns the full catalogue.

### P5-2 — Re-home user management + permission matrix · S · needs P5-1

- **Do** resolve open decision §8 #5 with this default: ADMIN keeps full `users:manage`, while HR_MANAGER may
  create and deactivate **EMPLOYEE-role logins only** and is refused when assigning any other role. Add
  `GET /roles/permissions` returning the role × permission matrix so the UI stops hardcoding it.
- **Done when** HR_MANAGER creating an HR_PAYROLL_USER login gets 403 while creating an EMPLOYEE login still
  works, and the matrix endpoint matches `ROLE_PERMISSIONS` exactly.

### P5-3 — UI user management · M · needs P5-2, P2-10

- **Files** `app/(app)/admin/users/*` (or extend `app/(app)/users`)
- **Do** admin list (search users / employees / email, role filter; columns user, linked employee, role,
  active, last login), create-edit drawer (employee link, username, password or generated invite, role,
  active), deactivate and password reset with a note that both revoke existing sessions.
- **Done when** an admin can create and immediately log in as a user of each role, and deactivation blocks
  future login/refresh. Immediate access-token invalidation requires the token-version/per-request check
  recorded in the P1/P2 verification notes.

### P5-4 — UI roles & permissions matrix · S · needs P5-2

- **Do** read-only module × action × role grid from `GET /roles/permissions`, with a note that permissions
  are code-defined in this build (not data-driven).
- **Done when** the grid matches `src/auth/permissions.ts` for all five roles.

### P5-5 — Smoke: admin boundaries · S · needs P5-2

- **Do** admin CRUD across one module per phase, self-role-change and self-deactivation blocked, HR_MANAGER
  role-escalation blocked.
- **Done when** smoke passes with the added checks and the new total is reflected in the README.

---

# Phase 6 — Deliverables & hardening

### P6-1 — Rule tests for HR + payroll services · M · needs P0-3

- **Do** extend vitest to the service rules the demo leans on: contract overlap, balance consumption on
  approve and cancel, working-day duration, and the engine end to end over the seeded structure. Use the
  ephemeral MySQL for the service-level tests.
- **Done when** `npm test` covers each area and fails when one rule is deliberately broken (verify one).

### P6-2 — API contract artifact · M · needs P3-6

- **Do** write or generate an OpenAPI 3.1 document (or a Postman / Bruno collection) covering every route
  with auth, one example request and one error example per module; reference it from the README.
- **Done when** importing the artifact produces a working login → list → create sequence against the local
  API.

### P6-3 — Representative dataset · M · needs P3-8

- **Do** grow the seed to the PDF's deliverable-1 bar: ~10 employees over 4 departments, contracts of each
  type, a full month of attendance including late / absent / overtime / missing-checkout days, approved and
  pending leave of both tracked and untracked types, two payruns (one PAID, one DRAFT) and bank details for
  most employees.
- **Done when** a once-seeded fresh database can demo every screen with no empty state and a dashboard with
  non-trivial numbers.

### P6-4 — Demo script · M · needs P3-11

- **Files** `docs/demo-script.md`
- **Do** scenario A: employee → contract → schedule assignment → attendance → payrun → payslip PDF.
  Scenario B: leave type → allocation → request → approval → balance consumed. Per step: which role to log
  in as, the route, what to point at, the expected result. Include the seeded logins and the reset command.
- **Done when** both scenarios run start to finish on a freshly seeded database with no detours.

### P6-5 — Deployment · M · needs P6-3

- **Do** production Dockerfile for the API (`prisma generate && tsc`, migrations on start), compose for API +
  MySQL, host the Next app with `NEXT_PUBLIC_API_URL` and `CORS_ORIGIN` set, `COOKIE_SECURE=true`, and real
  secrets kept out of the repo.
- **Done when** a clean checkout reaches a working login through the deployed URLs with `/health` green.
  Flag anything left exposed (no auth in front of the DB port, default secrets) before demoing.

### P6-6 — Roadmap summary · S · needs —

- **Files** `docs/roadmap.md`
- **Do** PDF deliverable 3: multi-role users, hours-based leave types, biometric attendance source, SSO,
  audit log, allocation approval workflow, employee payslip self-service, contract reference numbers — each
  with the schema and code touch points it would need.
- **Done when** every 📝 item in overall plan §8 is either resolved in this build or listed here.

---

## What shipped: the P0 and FE sessions (2026-09-05)

Two sessions, as asked: **session 1 = P0** (P0-1 → P0-2 → P0-3), **session 2 = FE** (FE-1 → FE-6). Every
step's own `Done` line above records its gate; this section is the cross-cutting view — how to reproduce
the state, what files exist now, where the build deviated from the plan as written, and what is left.

### Reproduce the verified state

```bash
# terminal 1 — the database (this machine has no Docker and no local MySQL)
cd ts-backend && EPHEMERAL_PORT=3307 npm run db:ephemeral   # migrates + seeds, stays up

# terminal 2 — the API
cd ts-backend && npm run dev                                # :8000/api/v1, /health → database: up
cd ts-backend && npm run typecheck && npm test && npm run smoke   # 0 errors · 68 tests · 57/57

# terminal 3 — the frontend
cd frontend && npx tsc --noEmit && npm run lint && npm run build  # all clean, 14 routes prerendered
cd frontend && npm run dev                                  # :3000 — log in as hr.manager / ChangeMe123!
```

Seeded logins are unchanged: `hr.manager` / `ChangeMe123!` for HR, any employee's work email (e.g.
`aarav.mehta@oxp.com`, `john.dsouza@oxp.com`) / `Employee123!` for EMPLOYEE.

### Files, by area

| Area | Files |
|---|---|
| Backend, changed | `package.json` (12 scripts), `README.md` (Prisma 6.19.3 pinned, script-based tables), `prisma.config.ts` + `prisma/schema.prisma` (connection string back in the schema), `src/lib/logger.ts` (no pretty transport under test) |
| Backend, new | `vitest.config.mts`, `src/auth/permissions.test.ts`, `src/lib/dates.test.ts`, `src/modules/attendance/derive.test.ts`, `src/modules/work-schedules/service.test.ts` |
| Docs | `docs/frontend-notes.md` (new), this file, `docs/overall-implementation-plan.md` |
| FE foundation | `app/layout.tsx`, `app/globals.css` (`@theme` tokens), `app/providers.tsx`, `components.json`, `lib/utils.ts`, `components/ui/*` (16 primitives), `components/theme-toggle.tsx`, `.env.example` |
| FE session & data | `lib/api/{client,types,index,employees,departments,attendance}.ts`, `lib/auth/session.tsx`, `lib/format.ts`, `hooks/use-can.ts`, `components/auth/require-session.tsx`, `app/(auth)/{layout.tsx,login/page.tsx}` |
| FE shell | `app/(app)/layout.tsx`, `app/(app)/page.tsx`, `app/(app)/error.tsx`, `app/not-found.tsx`, `components/shell/{nav-config.ts,sidebar.tsx,topbar.tsx,step-placeholder.tsx}`, `components/forbidden.tsx`, nine placeholder routes under `app/(app)/` |
| FE attendance | `components/attendance/widget.tsx` |
| FE list & form primitives | `hooks/use-list-params.ts`, `components/{data-table,filter-bar,pagination,kanban,page-header,status-badge}.tsx`, `components/form/{use-api-form.ts,field.tsx,form.tsx,index.ts}` |
| FE dev-only gates | `app/(dev)/layout.tsx`, `app/(dev)/scratch/page.tsx` (FE-2), `app/(dev)/scratch/lists/{page.tsx,lists-scratch.tsx}` (FE-6) |

`frontend/app/page.tsx` (the Next boilerplate) was deleted — `app/(app)/page.tsx` owns `/` now.

### Deviations from the plan as written

| Step | Plan said | What shipped, and why |
|---|---|---|
| P0-1 | touch `package.json` + `README.md` only | also `prisma.config.ts` and `prisma/schema.prisma`: the config-level `datasource.url` override is Prisma **7**, so on the pinned 6.19.3 every CLI command ran without a connection string. The URL is back in the schema; `dotenv/config` in the config file is what puts it in scope. |
| P0-3 | `vitest.config.ts` | `vitest.config.mts` — the package is CommonJS with `module: NodeNext`, so a `.ts` config's `export default` will not load. Also `src/lib/logger.ts` skips pino-pretty under `NODE_ENV=test` (its worker thread kept `vitest run` from exiting). Note `tsconfig.json` excludes `src/**/*.test.ts`, so `npm run typecheck` does not cover the tests — `npm test` is what exercises them. |
| FE-2 | "try `shadcn init`; hand-roll if Next 16 / Tailwind 4 isn't supported" | init worked (shadcn 4.21.0, `radix-nova`), so the 16 primitives are generated, not hand-rolled. It brings `radix-ui`, `next-themes`, `sonner`, `tw-animate-css` and `cn`; `lib/utils.ts` re-exports `cn` so every import stays `@/lib/utils`. |
| FE-3 | the file list in the step | added `components/auth/require-session.tsx` (a client guard for pages outside `(app)`, which the dev gate pages use) and `lib/format.ts`. The latter exists because of a real asymmetry in the API: date-only columns come back as UTC-midnight instants, while `?date=` / `?from=` accept only `YYYY-MM-DD`. |
| FE-4 | `components/shell/nav-config.tsx` | `nav-config.ts` — it is a data table, not markup. Nine `StepPlaceholder` routes were added so every nav link resolves (otherwise the gate's `/departments`-as-employee check hits 404 rather than the 403 screen), plus `step-placeholder.tsx`, `(app)/error.tsx`, `theme-toggle.tsx` and an interim `(app)/page.tsx`. |
| FE-5 | "today's row in `/attendance` shows matching worked and break hours" | verified through `GET /attendance/records?date=…` instead: `/attendance` is still a placeholder because that screen is **P1-3**. Same assertion, one layer down. |
| FE-6 | six components + `components/form/*` | added `hooks/use-list-params.ts` (one URL reader for every primitive) and exported `ListError` from `data-table.tsx` for the kanban to reuse. Search submits on Enter / blur rather than debouncing each keystroke — `react-hooks/set-state-in-effect` rules out the usual controlled-input-plus-effect shape, and an uncontrolled input keeps the caret where the user left it. "No filter" in a select is an `__any__` sentinel because Radix reserves `value=""`. Only keys in a module's server-side sort allow-list are marked `sortable`. |
| FE-6 | — | the gate pages live in a **dev-only `(dev)` route group** (`/scratch`, `/scratch/lists`) outside the authenticated shell. They are not product screens; drop or gate them in P6-5 before anything is deployed. |
| Decision #6 | "swap the group key in `components/employees/kanban.tsx`" | the kanban shipped generic at `components/kanban.tsx`; the group axis is now the caller's `groupOf` prop, so P2-1 changes one prop rather than a component. |

### What is left

- **Four browser walk-throughs a human has to click** (each is a UI-only assertion no script can stand in
  for): FE-3's two logins + hard reload + the 401 → refresh → retry trio with `JWT_ACCESS_TTL_MINUTES=1`;
  FE-4's HR-vs-employee menu diff, `/departments` as an employee, and logout; FE-5's punch sequence from
  the header including a second clock-in in a second tab; FE-6's `/scratch/lists` — search, sort, page,
  reload, Back, then submit the pre-filled duplicate `Engineering`.
- **Nothing is committed.** Every change above sits in the working tree (`git status` lists the modified
  files, the one deletion and the new directories). The two sessions map cleanly onto two commits — one for
  P0, one for FE — whenever you want them.
- **Next steps:** Phase 4 is complete; P5-1 is the next executable build step. The provisional payroll schema must still be reconciled with authoritative Phase 3/4 SQL when it arrives, but this remains a tracked schema-authority risk rather than an incomplete implementation.

## Decisions this plan makes on your behalf

| # | Decision | Why | How to reverse |
|---|---|---|---|
| 1 | P3-1 added all three remaining `RoleName` values in one migration | Three enum migrations buy nothing; permissions, not the enum, gate access (deviates from overall plan §8 #3) | A future authoritative reconciliation migration can change the enum strategy if required |
| 2 | The team payroll SQL was unavailable, so P3-0 exercised the documented provisional-schema fallback | Phases 3–5 would otherwise stall; all payroll tables landed in one isolated additive migration and every choice is recorded in `docs/phase-3-plan.md` | Compare with authoritative SQL when supplied and reconcile through a later migration |
| 3 | Access token in memory, refreshed from the httpOnly cookie on load | No token in `localStorage`; the cookie is already scoped to `/api/v1/auth` | — |
| 4 | Employee payslip self-service is out of scope | Not in the role sketch; the service still reads through `scopeToEmployee()` so it's a permission flip | Add `payslips:read-own` to EMPLOYEE |
| 5 | HR_MANAGER may create EMPLOYEE logins only once ADMIN exists (P5-2) | Resolves open decision §8 #5 without stranding Phase 2's Users screen | Keep full `users:manage` on HR_MANAGER |
| 6 | Kanban groups employees by department | The mockup shows grouped cards without naming the key; department is the useful axis | Swap the group key in `components/employees/kanban.tsx` |

## Where progress is recorded

- Tick the status board in this file when a step's gate passes.
- Update the matching row in `docs/overall-implementation-plan.md` — §2.7 for Phase 1–2 screens, §4–6 for
  payroll and admin, §7 for cross-phase deliverables.
- Write `docs/phase-<n>-plan.md` when a phase's schema lands (P3-0 does this for Phase 3), following the
  §9 playbook in the overall plan.
- Keep `ts-backend/README.md` current on new endpoints, env vars and seeded logins as each phase lands.


---

# P1/P2 final verification (2026-09-05)

Phase 1 (EMPLOYEE) and Phase 2 (HR_MANAGER) are implemented and verified together. The combined gate produced this evidence:

- Frontend production build: `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run build -- --webpack` passed twice, including TypeScript, prerendering, and route generation for `/`, `/employees`, `/employees/me`, `/attendance`, `/contracts`, `/departments`, `/work-schedules`, `/time-off`, `/time-off/requests`, `/time-off/balances`, `/time-off/types`, and `/users` plus dynamic detail routes.
- Frontend static checks: `npx tsc --noEmit` passed; `npm run lint` passed with zero errors and zero warnings.
- Backend static checks: `npm run prisma:generate` and `npm run typecheck` passed.
- Unit tests: `npm test` passed **68/68 tests in 4 files**.
- Integration: ephemeral MySQL **8.4.9** started, the initial migration applied, the representative seed completed, and the API connected successfully.
- End-to-end API/RBAC/business-rule smoke: `npm run smoke` passed **57/57 checks**. Temporary API and database processes were stopped afterward.

Known deviations and environment limitations:

1. Next.js 16.3.4's default Turbopack `npm run build` exits abnormally with code `-1` and no diagnostic on this Windows machine, including with a 4 GB Node heap. The documented and verified production-build fallback is `npm run build -- --webpack`.
2. The backend exposes no `DELETE /users/:id`; P2-10 intentionally offers deactivation rather than inventing a delete operation.
3. Deactivation and password changes revoke refresh tokens, but an already-issued access token remains valid until expiry. A user's next request is therefore not guaranteed to return 401 immediately.
4. A referenced leave-type delete is an actual **422 BUSINESS_RULE_VIOLATION**, not the stale planned 409; the UI keeps delete actionable and displays the API message verbatim.

No browser-only manual click-through was recorded in this automated gate. Compilation, routing, permission boundaries, mutations, rule failures, migration/seed, and cross-module workflows are covered by the checks above.


---

# P1/P2/P3 final verification (2026-09-05)

Phase 3 (`HR_PAYROLL_USER`) is implemented and was verified together with the existing Phase 1–2 behavior. The combined gate produced this evidence:

- Frontend static checks: `npx tsc --noEmit` and `npm run lint` passed with zero errors.
- Frontend production build: Next.js **16.3.4** passed with `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run build -- --webpack`; static generation completed 23/23 and the build emitted `/payroll/payruns`, `/payroll/payruns/[id]`, `/payroll/payslips`, `/payroll/payslips/[id]`, `/payroll/structures`, `/payroll/structures/[id]`, and `/payroll/rules`.
- Backend static checks: `npm run prisma:generate` and `npm run typecheck` passed.
- Unit tests: `npm test` passed **81/81 tests in 5 files**.
- Integration: fresh ephemeral MySQL **8.4.9** applied `20260905000000_init` and `20260905010000_phase_3_payroll`, then exposed **21 tables** (20 application tables plus `_prisma_migrations`).
- Seed: the complete representative seed ran successfully twice; the second run skipped/reused existing records without duplicates, proving idempotency.
- End-to-end API/RBAC/business-rule smoke: `npm run smoke` passed **84/84 checks**. Payroll evidence includes the permission superset and lower-role 403s, salary reads, selected-only creation, duplicate eligibility flags, repeated compute, warning split, lifecycle guards, payslip detail/recompute, `%PDF` streaming, offline JSON mail results, paid immutability, and cancellation.
- Cleanup: temporary API and ephemeral database processes were stopped after validation.

Known deviations and environment limitations:

1. The prior default Turbopack attempt exited with code `-1` and no diagnostic on this Windows host. The successful and documented production gate is the Webpack fallback above.
2. `npm install` reported **5 vulnerabilities (1 moderate, 4 high)**. No destructive or potentially breaking `npm audit fix --force` was run; dependency remediation remains separate work requiring compatibility review.
3. The Phase 3 payroll schema is implemented but remains **provisional** because authoritative Phase 3/4 team SQL has not been supplied. `docs/phase-3-plan.md` records every schema choice and reconciliation point.
4. Missing SMTP intentionally uses Nodemailer's offline JSON transport rather than creating an Ethereal account or making an outbound request.

No browser-only manual click-through was recorded in this automated gate. Compilation, route generation, permission boundaries, mutations, lifecycle failures, migration/seed, calculation, PDF response, and mail fallback are covered by the checks above.


---

# Phase 4 final verification (2026-09-06)

Phase 4 (`HR_PAYROLL_MANAGER`, P4-1…P4-7) is implemented and was verified with the existing Phase 1–3 behavior. The final gate produced this evidence:

- Backend static checks: `npm run prisma:generate` and `npm run typecheck` passed.
- Unit tests: `npm test` passed **82/82 tests in 5 files**, including 14 permission-catalogue tests.
- Integration: fresh ephemeral MySQL **8.4.9** applied `20260905000000_init` and `20260905010000_phase_3_payroll`, exposed **21 tables**, completed the representative seed, and completed an immediate second seed without duplicates.
- End-to-end API/RBAC/business-rule smoke: `npm run smoke` passed **113/113 checks**. Phase 4 coverage includes manager permission supersets; lower-role 403s; config CRUD, conflicts, reorder and reference guards; DRAFT delete cascades; later-state cancellation/history preservation; paid-payslip snapshot immutability; and the aggregate dashboard response.
- Dashboard audit: for `2026-08-01` through `2026-09-30`, independent Prisma queries reproduced the API's payslip count (**4**), monthly net total (**394337.50**), average salary per generated employee (**98584.38**) and approved time-off total (**4 days**).
- Frontend static checks: `npx next typegen`, `npx tsc --noEmit`, and `npm run lint` passed with zero warnings.
- Frontend production build: Next.js **16.3.4** passed with `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run build -- --webpack`; static generation completed **24/24** and emitted `/payroll/dashboard` plus all salary-config and payroll lifecycle routes.
- Cleanup: temporary API and ephemeral database processes were stopped after validation.

Known limitations remain unchanged: authoritative Phase 3/4 SQL has not been supplied, so the isolated payroll migration is provisional and must be reconciled later; no browser-only manual click-through was recorded; and the backend dependency audit finding (**5 vulnerabilities: 1 moderate, 4 high**) was not force-fixed without compatibility review.