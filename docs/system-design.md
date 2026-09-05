# PeoplePay360 — System Design of What Is Built Today

**Status:** describes the code in `main` as of 2026-09-05 (`f6fb82f`). Everything below was read out of
the source, not out of the plan documents. Where something is *planned but not built*, it is called out
explicitly in [§14 Gaps](#14-what-is-not-built-yet).

- What exists: a complete Express REST API for **Phase 1 (EMPLOYEE)** and **Phase 2 (HR_MANAGER)** —
  14 tables, 12 route groups, 19 permissions, migrated and seeded on MySQL 8.4, 57 smoke checks green.
- What does not: the Next.js frontend (still `create-next-app` boilerplate), any payroll table
  (phases 3–5 schema hasn't arrived), and automated tests (vitest is installed, zero specs written).

Companion docs: [overall-implementation-plan.md](docs/overall-implementation-plan.md) (what to build),
[build-plan.md](docs/build-plan.md) (the step queue), [phase-1-plan.md](docs/phase-1-plan.md) (the
Phase 1–2 spec this backend implements).

---

## 1. Tech stack and why each piece is there

| Layer | Choice | Why this one |
|---|---|---|
| Runtime | Node.js + **tsx** in dev, `tsc` → `dist/` for prod | tsx runs TypeScript directly with watch mode, so there is no build step in the dev loop |
| Language | **TypeScript 7**, `strict` | the business rules are date/decimal heavy; the compiler is the cheapest test we have |
| HTTP | **Express 5.2** | Express 5 forwards rejected promises from `async` handlers to the error middleware, which is why no route in this codebase has a `try/catch` or an `asyncHandler` wrapper |
| DB | **MySQL 8.4** | what the team's SQL schema targets |
| ORM | **Prisma 6.19.3** (pinned) + `@prisma/adapter-mariadb` | typed queries and interactive transactions; the driver adapter lets us set `timezone: 'Z'` on the pool. Pinned deliberately — Prisma 7 broke the build in `ae76dee`, **do not upgrade** |
| Validation | **zod 4** | one schema per endpoint doubles as the TypeScript input type (`z.infer`), so the router and the service agree by construction |
| Auth | **jsonwebtoken** (HS256 access token) + opaque random refresh token, **bcryptjs** at 12 rounds | short-lived stateless access token for request auth, DB-backed rotating refresh token so sessions can actually be revoked |
| Logging | **pino** + `pino-http`, `pino-pretty` in dev | structured JSON in prod, readable lines locally |
| Security | **helmet**, **cors** with credentials, `cookie-parser` | standard headers; the refresh cookie needs cookie parsing and a credentialed CORS origin |
| Tests | vitest 5 + supertest (installed), plus a hand-rolled `scripts/smoke.ts` | the smoke script is what actually verifies the system today |
| Local DB | `mysql-memory-server` via [ephemeral-db.ts](ts-backend/scripts/ephemeral-db.ts) | the dev machine has neither MySQL nor Docker installed |

Frontend stack is **decided but unwritten**: Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui,
TanStack Query, react-hook-form + zod.

---

## 2. The shape of the system

```
browser ──HTTP──▶ Express app  ─▶  Router (per module)
                     │                 │  zod parse → service call
                     │                 ▼
                     │            Service  ──── business rules live HERE
                     │                 │      (the only layer that touches Prisma)
                     │                 ▼
                     └── errorHandler ◀── Prisma Client ──▶ MySQL
```

Three rules hold everywhere, and they are the reason the code stays predictable:

1. **Routers do no thinking.** A route parses input with a zod schema, checks a permission, calls one
   service function, and serialises the result. See [attendance/router.ts](ts-backend/src/modules/attendance/router.ts) —
   every handler is one line of work.
2. **Services own all business rules and are the only place `prisma` is imported.** Nothing above them
   knows the database exists.
3. **Nothing derivable is stored.** Worked hours, overtime, lateness, leave remaining/available, weekly
   hours — all computed on read. There is exactly one stored aggregate (`leave_balances.used_days`) and
   it has a recompute endpoint as a safety net (§8.5).

### Directory layout

```
ts-backend/src/
  index.ts              bootstrap: connect DB, listen, graceful shutdown
  app.ts                middleware chain + mounts /api/v1
  routes.ts             /health + mounts the 12 module routers
  config/env.ts         zod-validated environment (fails fast at boot)
  lib/
    prisma.ts           Prisma client, driver adapter, Decimal→JSON patch
    security.ts         password hashing, JWT sign/verify, refresh tokens, Actor
    errors.ts           AppError hierarchy → HTTP status codes
    dates.ts            the date/time conventions (the trickiest file in the repo)
    validation.ts       reusable zod primitives (dateOnly, instant, days…)
    http.ts             pagination, sort allow-list, {data, meta} envelope
    logger.ts           pino instance
  middleware/           authenticate, authorize, error-handler, not-found
  auth/permissions.ts   permission catalogue + role map + row-level scoping
  modules/<name>/
    router.ts           routes + permissions
    schema.ts           zod input schemas (also the service's input types)
    service.ts          business rules + Prisma
    derive.ts           (attendance only) pure calculations, no DB
    resolve.ts          (work-schedules only) shared schedule resolution
  generated/prisma/     Prisma client output, committed
```

`modules/` is where a feature lives end to end; adding one means adding a folder and one line in
[routes.ts](ts-backend/src/routes.ts).

---

## 3. Request lifecycle, end to end

Take `GET /api/v1/attendance/records?page=1&from=2026-09-01` as the worked example.

| # | Where | What happens |
|---|---|---|
| 1 | [app.ts:18](ts-backend/src/app.ts:18) | `helmet()` sets security headers |
| 2 | [app.ts:19](ts-backend/src/app.ts:19) | `cors()` — origin from `CORS_ORIGIN` (comma-separated), `credentials: true` so the refresh cookie can travel |
| 3 | [app.ts:25](ts-backend/src/app.ts:25) | `express.json({ limit: '1mb' })` then `cookieParser()` |
| 4 | [app.ts:28](ts-backend/src/app.ts:28) | `pino-http` logs the request (skipped entirely when `NODE_ENV=test`; `/health` is not logged) |
| 5 | [app.ts:36](ts-backend/src/app.ts:36) | `apiRouter` mounted at `/api/v1` → `attendanceRouter` at `/attendance` |
| 6 | [attendance/router.ts:17](ts-backend/src/modules/attendance/router.ts:17) | `authenticate` — `Authorization: Bearer <jwt>` verified, `req.actor` set |
| 7 | [attendance/router.ts:42](ts-backend/src/modules/attendance/router.ts:42) | `authorize('attendance:read')` — role must hold the permission, else 403 |
| 8 | same line | `listRecordsSchema.parse(req.query)` — unknown/invalid params throw `ZodError` |
| 9 | [attendance/service.ts:134](ts-backend/src/modules/attendance/service.ts:134) | `scopeToEmployee(actor, query.employeeId)` — an EMPLOYEE is silently narrowed to their own rows; asking for someone else's id throws 403 |
| 10 | service | `where` built from the filters, then `findMany` + `count` in one `Promise.all` |
| 11 | service | each row gets `derived` computed in memory, sharing a `ScheduleCache` so N rows cost 1 query per distinct employee, not N |
| 12 | [http.ts](ts-backend/src/lib/http.ts) | `listResponse()` wraps it as `{ data, meta }` |
| 13 | [error-handler.ts](ts-backend/src/middleware/error-handler.ts) | only if something threw — maps the error to `{ error: { code, message, details? } }` |

Anything thrown at any step — zod, an `AppError` from a service, a raw Prisma error — lands in the same
error middleware, because Express 5 auto-forwards async rejections. That is the whole reason handlers
are one-liners.

---

## 4. Bootstrap and configuration

[index.ts](ts-backend/src/index.ts) is deliberately dull: `await connectDatabase()` → `createApp()` →
`listen(env.PORT)`. On `SIGINT`/`SIGTERM` it stops accepting connections, disconnects Prisma, and arms a
10-second `setTimeout(...).unref()` force-exit so a hung socket can't block a redeploy. A failure in
`main()` logs `logger.fatal` and exits 1.

### Environment is validated, not trusted

[config/env.ts](ts-backend/src/config/env.ts) parses `process.env` through a zod object **at import
time**. A missing `DATABASE_URL` or a `JWT_ACCESS_SECRET` under 16 characters kills the process with a
printed list of problems instead of failing at the first request. `APP_TIMEZONE` gets an extra check —
it is fed to `new Intl.DateTimeFormat('en-US', { timeZone })` and must not throw.

Every business knob that could have been a magic number is an env var:

| Var | Default | Used by |
|---|---|---|
| `JWT_ACCESS_TTL_MINUTES` | 15 | access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | 7 | refresh-token expiry |
| `COOKIE_SECURE` | — | `Secure` flag on the refresh cookie |
| `DEFAULT_CURRENCY` | `USD` (repo `.env.example` uses `INR`) | contract currency when the caller omits it |
| `APP_TIMEZONE` | `UTC` (example: `Asia/Kolkata`) | what "today" and "arrived at" mean |
| `LATE_GRACE_MINUTES` | 0 (example: 10) | how late is late |
| `SEED_*` | — | seed credentials |

There is no hardcoded pay period, no hardcoded 5-day week, no hardcoded leave allowance anywhere in
`src/` — those come from `work_schedules` and `leave_types` rows.

### The database client

[lib/prisma.ts](ts-backend/src/lib/prisma.ts) does three non-obvious things:

1. **`Prisma.Decimal.prototype.toJSON = () => this.toNumber()`.** Without this, every `DECIMAL` column
   serialises as `{"s":1,"e":1,"d":[20]}` in JSON. With it, `allocatedDays` is just `20`. This is why
   the API returns clean numbers for salaries and leave days.
2. **`poolConfigFromUrl()`** hand-parses `DATABASE_URL` instead of handing it to the driver: it rejects
   anything that isn't `mysql:`/`mariadb:`, requires a database name, honours `?connection_limit=`
   (default 10), and — critically — sets **`timezone: 'Z'`** on the pool so the MariaDB driver does not
   shift `DATE`/`DATETIME` values into the server's local zone.
3. Exports `connectDatabase()` / `disconnectDatabase()` so the lifecycle is explicit in `index.ts`.

---

## 5. Data model

14 tables, one migration (`20260905000000_init`). Prisma models are camelCase; MySQL columns stay
snake_case via `@map`/`@@map`, so the team's original SQL naming survives.
Source: [schema.prisma](ts-backend/prisma/schema.prisma).

```
roles ──< users >── employees ──< contracts
                        │  │
                        │  ├──< employee_schedule_assignments >── work_schedules
                        │  ├──< attendance_records >── attendance_entries
                        │  ├──< leave_balances >── leave_types
                        │  └──< time_off_requests >── leave_types
                        │            └──1 time_off_approvals ──> employees (reviewer)
                        └──(manager_id self-reference)
users ──< refresh_tokens
```

### Grouping and intent

| Group | Tables | Notes |
|---|---|---|
| Lookup | `roles`, `departments`, `leave_types`, `work_schedules` | all have a unique natural key, so the seed can upsert them idempotently |
| People | `employees`, `users` | identity is split from personal data: `users` holds `password_hash`/`role_id`, `employees` holds the HR record. `users.employee_id` is `@unique` → at most one login per person, `onDelete: Cascade` |
| Session | `refresh_tokens` | not in the team's original schema; added so sessions are revocable |
| Employment | `contracts`, `employee_schedule_assignments` | both are *interval* tables: `[start, end]` with a nullable open end |
| Time | `attendance_records` (one per employee-day) → `attendance_entries` (raw punches) | the record is the day, the entries are the events |
| Leave | `leave_balances`, `time_off_requests`, `time_off_approvals` | approval is 1:1 with a request (`@unique` on `time_off_request_id`) so the decision is auditable and unrepeatable |

### Invariants and where each one is enforced

| Invariant | Enforced by |
|---|---|
| one attendance record per employee per day | DB unique `uq_attendance_employee_date` **and** a pre-check that returns a friendly 409 |
| one balance row per (employee, leave type, year) | DB unique `uq_leave_balance_employee_type_year` |
| one schedule assignment per (employee, effective_from) | DB unique + a service-level overlap check (the DB constraint alone would allow two overlapping ranges with different start dates) |
| no two overlapping **ACTIVE** contracts | service only — [contracts/service.ts:51](ts-backend/src/modules/contracts/service.ts:51) |
| `end_date >= start_date` | zod schema + service re-check on partial updates |
| approval reviewer must be HR | route permission `time-off:decide`; the schema documents it as a comment |
| enums | real MySQL `ENUM` columns (the team's Postgres `CHECK` constraints translated) |

Anything that a single row cannot express (overlaps, cross-row sums, sequence validity) is a service
rule, because MySQL cannot express it declaratively. Anything a row *can* express is a DB constraint, so
a bug in the service layer still cannot corrupt the data.

### The date/time contract

[lib/dates.ts](ts-backend/src/lib/dates.ts) exists because dates are the main source of quiet bugs here.
The conventions, applied everywhere:

- **`DATE` columns** (`attendance_date`, `start_date`, `hire_date`, …) are stored as **UTC midnight**
  `Date` objects. `parseDateOnly('2026-09-05')` builds that and round-trips through `toDateOnly()` to
  reject impossible calendar dates like `2026-02-30`, which the raw regex would accept.
- **`TIME` columns** (`work_schedules.start_time`) are `Date`s on **1970-01-01 UTC**. `timeToMinutes()`
  reads their UTC hours/minutes, i.e. schedule times are *wall-clock times in `APP_TIMEZONE`*, never
  absolute instants.
- **Punch instants** (`attendance_entries.entry_time`) are true UTC timestamps.
- Converting an instant to a local calendar day is `localParts(instant)` — it runs
  `Intl.DateTimeFormat` with `hourCycle: 'h23'` in `APP_TIMEZONE` and returns
  `{ dateStr, dateOnly, minutesOfDay, isoWeekday }`. `todayLocal()` is the "today" every service uses.
- `isoWeekday()` maps Sunday from JS's `0` to ISO `7`, so `days_of_week: [1..7]` means Mon–Sun.

That is why a 9 am punch in Mumbai lands on the Mumbai day even though it is 03:30 UTC.

---

## 6. Authentication

Two tokens, deliberately different in kind — [lib/security.ts](ts-backend/src/lib/security.ts) and
[modules/auth/service.ts](ts-backend/src/modules/auth/service.ts).

| | Access token | Refresh token |
|---|---|---|
| Kind | JWT, HS256, stateless | 48 random bytes, base64url, opaque |
| Claims / storage | `{ sub: userId, eid: employeeId, role, usr: username }` | only its **SHA-256 hash** is stored in `refresh_tokens`; the raw value is never persisted |
| Lifetime | `JWT_ACCESS_TTL_MINUTES` (15) | `REFRESH_TOKEN_TTL_DAYS` (7) |
| Transport | `Authorization: Bearer …` header | httpOnly cookie `pp360_refresh`, `sameSite: 'lax'`, path **`/api/v1/auth`** (also accepted in the request body for non-browser clients) |
| Revocable | no — it just expires | yes — `revoked_at` |

The split is the point: the access token is cheap to verify (no DB round trip on every request, the JWT
*is* the `Actor`), and the refresh token is the thing that can actually be revoked.

### Login

[auth/service.ts:71](ts-backend/src/modules/auth/service.ts:71)

```
POST /api/v1/auth/login  { username, password }
  → findFirst where username = X OR employee.email = X   (login with either)
  → if no user, or user.isActive === false  → 401 "Invalid credentials"
  → bcrypt.compare(password, passwordHash) → 401 "Invalid credentials"
  → users.last_login_at = now()
  → issueSession()
```

Unknown user, wrong password and deactivated account all return the **same** 401 message — no user
enumeration. `issueSession()` signs the access token, inserts a refresh-token row, and returns
`{ accessToken, expiresIn, tokenType, refreshToken, refreshExpiresAt, user }` where `user` includes
`permissions: string[]` (§7) so the frontend can gate UI without hardcoding role names.

### Refresh = rotation

[auth/service.ts:87](ts-backend/src/modules/auth/service.ts:87): look the presented token up **by hash**;
reject if unknown, revoked, or expired; reject if the account has since been deactivated; then mark the
presented token `revoked_at = now()` and issue a brand-new pair. So every refresh invalidates the token
that was used — replaying a stolen refresh token after the legitimate client has refreshed fails. The
smoke suite asserts exactly this (`reused refresh token rejected → 401`).

`POST /auth/logout` revokes the presented token and clears the cookie, always 204.
`GET /auth/me` re-reads the user from the DB (so a role change lands without re-login) and 404s if the
row is gone.

### Sessions get killed by side effects, not just by logout

Anything that should end a session revokes all of that user's live refresh tokens in the same
transaction as the change:

- password change or `isActive: false` → [users/service.ts:103](ts-backend/src/modules/users/service.ts:103)
- employee status set to anything but `ACTIVE` → [employees/service.ts:124](ts-backend/src/modules/employees/service.ts:124)
- employee termination → [employees/service.ts:156](ts-backend/src/modules/employees/service.ts:156)

The already-issued access token still works until it expires (≤15 min). That is the deliberate trade-off
of stateless access tokens; shortening `JWT_ACCESS_TTL_MINUTES` shrinks the window.

---

## 7. Authorization — two independent layers

Authorization is answered twice, and both answers are needed.

### Layer 1: can this role call this endpoint? (coarse)

[auth/permissions.ts](ts-backend/src/auth/permissions.ts) defines 19 permissions as a `const` tuple, so
`Permission` is a union type and a typo in a router is a compile error:

```
users:manage
departments:read|write     leave-types:read|write     work-schedules:read|write
employees:read|write       contracts:read|write
attendance:read|punch|write
leave-balances:read|write
time-off:read|request|decide
```

`ROLE_PERMISSIONS` maps roles to sets: **HR_MANAGER holds all 19**; **EMPLOYEE holds 10** — every
`*:read`, plus `attendance:punch` and `time-off:request`. No `*:write`, no `time-off:decide`, no
`users:manage`. [middleware/authorize.ts](ts-backend/src/middleware/authorize.ts) takes a list and
requires **all** of them, reporting the missing ones in the 403 message.

The catalogue is also shipped to the client on `/auth/login` and `/auth/me`, which is why the UI can do
`if (permissions.includes('time-off:decide'))` instead of `if (role === 'HR_MANAGER')`. When phases 3–5
add roles, the UI does not change.

### Layer 2: whose rows may it touch? (row-level)

A permission check alone would let an employee with `attendance:read` read everyone's attendance. The
row filter is `scopeToEmployee(actor, requested?)`:

| Caller | `requested` | Result |
|---|---|---|
| HR_MANAGER | `5` | `5` — filter to employee 5 |
| HR_MANAGER | `undefined` | `undefined` — **no filter**, sees everything |
| EMPLOYEE | `undefined` or own id | own `employeeId` |
| EMPLOYEE | someone else's id | throws `ForbiddenError` → 403 |

Services then spread it into the `where`: `...(own !== undefined ? { employeeId: own } : {})`. Two
variants exist: `requireEmployeeScope()` when a concrete id is mandatory (creating a time-off request),
and `canSeeAllEmployees()` for the handful of asymmetric rules (only HR may cancel an *approved* leave).

Consequence worth internalising: **`GET /employees` is the same endpoint for both roles.** An employee
gets `meta.total = 1`; HR gets everyone. There is no separate "my" endpoint to keep in sync — the
`/me` routes that do exist ([employees/router.ts:21](ts-backend/src/modules/employees/router.ts:21)) are
conveniences that skip needing to know your own id.

---

## 8. Cross-cutting conventions the whole API obeys

Every screen can be written against these four contracts without reading any module.

**Lists.** Query params `page` (≥1, default 1), `pageSize` (1–100, default 20), `sort`, `order`
(`asc|desc`), `q` (free-text). Response:

```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 } }
```

`toOrderBy()` checks `sort` against a per-endpoint **allow-list** and falls back to a default column, so
a caller cannot sort by an arbitrary field (or inject one). [lib/http.ts](ts-backend/src/lib/http.ts)

**Errors.** Always `{ "error": { "code", "message", "details"? } }`.
[middleware/error-handler.ts](ts-backend/src/middleware/error-handler.ts) maps:

| Thrown | HTTP | `code` |
|---|---|---|
| `ZodError` | 400 | `VALIDATION_ERROR` + `details.issues[{path, message}]` |
| `BadRequestError` | 400 | `BAD_REQUEST` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `BusinessRuleError` | **422** | `BUSINESS_RULE_VIOLATION` |
| Prisma `P2002` / `P2003` / `P2025` | 409 / 409 / 404 | `UNIQUE_VIOLATION` / `FOREIGN_KEY_VIOLATION` / `NOT_FOUND` |
| malformed JSON body | 400 | `BAD_REQUEST` |
| anything else | 500 | `INTERNAL_ERROR` (logged with path + method) |

The 409-vs-422 distinction is meaningful and consistent: **409 = collides with existing data**
(duplicate department, overlapping contract), **422 = the request is well-formed but breaks a rule**
(double clock-in, insufficient leave balance). `BusinessRuleError` carries machine-readable `details` —
the insufficient-balance error returns `allocated/carried/used/pending/available/requested` so the UI can
render "you have 3 days left, you asked for 5" without a second call.

**Input parsing.** Each module's `schema.ts` owns its zod schemas and the service's input types come from
`z.infer`. Shared primitives in [lib/validation.ts](ts-backend/src/lib/validation.ts): `dateOnly`
(`YYYY-MM-DD` → UTC midnight), `instant` (offset-bearing ISO datetime → `Date`), `days` (0–999.99, 2dp),
`positiveInt` (coerced from query strings), `boolQuery`.

**JSON types.** `DECIMAL` → number (via the `toJSON` patch), `DATE` → `"2026-09-05T00:00:00.000Z"`,
`TIME` → formatted `"09:00"` by `presentSchedule()`, enums → their string names.

---

## 9. The business logic, module by module

### 9.1 Work schedules — the foundation everything else stands on

A `work_schedules` row is a pattern: `days_of_week` (a JSON array of ISO weekdays, because MySQL has no
array type), `start_time`, `end_time`. `weekly_hours` is stored but **only as a cache** — it is
recomputed from the other three columns on every create/update, and readers fall back to computing it if
it is null.

[work-schedules/resolve.ts](ts-backend/src/modules/work-schedules/resolve.ts) is small and is imported by
three other modules:

| Function | Meaning |
|---|---|
| `scheduleDays(s)` | the JSON column zod-parsed to `number[]` (returns `[]` if malformed — never throws mid-report) |
| `dailyHours(s)` | `(end − start) / 60`, rounded to 2dp |
| `weeklyHours(s)` | `days.length × dailyHours` |
| `isWorkingDay(s, date)` | `days.includes(isoWeekday(date))` |
| `resolveScheduleFor(employeeId, date, tx?)` | **the resolver**: the assignment whose `[effective_from, effective_to ?? ∞]` contains `date`, newest first |
| `countWorkingDays(s, from, to)` | inclusive day walk; **with no schedule every calendar day counts** |

`resolveScheduleFor` accepts a transaction client, so time-off can resolve a schedule inside the same
transaction that validates the request. `countWorkingDays`' no-schedule fallback is a conscious choice:
rather than assume Mon–Fri, it counts every day, so a missing assignment produces an obviously-too-large
number instead of a silently plausible wrong one.

Deleting a schedule that is assigned to anyone is refused with 422 (`assignmentCount > 0`).

### 9.2 Attendance — a state machine plus pure derivation

This is the most interesting module. It separates *facts* (rows) from *conclusions* (computed), and the
conclusions live in a file with no database access at all:
[attendance/derive.ts](ts-backend/src/modules/attendance/derive.ts).

**The stored facts.** `attendance_records` = one row per employee-day with a `status`.
`attendance_entries` = the raw punches (`CLOCK_IN`, `CLOCK_OUT`, `BREAK_START`, `BREAK_END`) with a UTC
`entry_time` and a `source` (`WEB`, `MOBILE_APP`, `BIOMETRIC`, `MANUAL`). Nothing about hours is stored.

**The state machine.** Legal transitions are a table, not a pile of `if`s:

```
OUT      --CLOCK_IN-->    IN
IN       --CLOCK_OUT-->   OUT
IN       --BREAK_START--> ON_BREAK
ON_BREAK --BREAK_END-->   IN
```

Every other combination is illegal, and `transitionError()` turns each one into a sentence a user can act
on — *"End your break before clocking out"*, *"Clock in before starting a break"* — returned as 422.

`analyse(entries)` sorts the punches by time and walks them through that table, accumulating
`sessionMs` (time inside closed in→out sessions), `breakMs` (time inside closed breaks), the first
clock-in, the last clock-out, and what is still open. Because it is a fold over sorted events, the same
function answers three different questions: *what is my state right now?*, *is this proposed punch legal?*
and *is this HR edit going to leave the day self-consistent?*

`derive(entries, date, schedule, now)` turns that into the fields the UI shows:

| Field | Rule |
|---|---|
| `workedHours` | `max(0, sessionMs − breakMs) / 3.6e6`, 2dp — **breaks are unpaid** |
| `breakHours` | closed breaks only |
| `expectedHours` | `dailyHours(schedule)` on a working day, `0` on a non-working day, **`null` when no schedule is assigned** |
| `overtimeHours` | `max(0, worked − expected)`, and **`0` when `expectedHours` is null** — with no schedule there is no expectation, so no overtime is claimed |
| `isLate` / `lateByMinutes` | `localParts(firstClockIn).minutesOfDay > schedule.startTime + LATE_GRACE_MINUTES`. Only on working days, only with a schedule |
| `missingCheckout` | still open (`state ≠ OUT`) **and** the record's date is before today-local — yesterday's unclosed session, not this morning's |
| `elapsedMinutes` | live counter for the header widget: `now − openSince`, minus the currently-running break |
| `isValidSequence` / `sequenceError` | set when historical rows contain a sequence the machine rejects, so bad data is reported rather than silently mis-totalled |

Three consequences of computing instead of storing: a schedule correction retroactively fixes every
affected day's overtime; changing `LATE_GRACE_MINUTES` re-decides lateness for history; and there is no
"recalculate attendance" job to run.

**Punching.** `POST /attendance/{clock-in|clock-out|break-start|break-end}` all funnel into
[`punch()`](ts-backend/src/modules/attendance/service.ts:73): resolve today in `APP_TIMEZONE`, refuse
non-`ACTIVE` employees (422), then inside a transaction — read today's record and its entries, run the
state check, create the record if this is the first punch of the day, and insert the entry. A punch on a
day previously marked `ABSENT`/`WEEK_OFF` flips the record back to `PRESENT`: showing up beats the
overnight job's guess. The response is the same payload as `GET /attendance/session`, so the widget
re-renders from the punch response with no follow-up request.

`GET /attendance/session` returns `{ state, checkedIn, onBreak, allowedActions, derived, record,
serverTime }`. `allowedActions` is computed by asking `nextState()` which of the four punches is legal
right now — so the UI enables buttons from data instead of re-implementing the state machine, and
`serverTime` lets it run its own clock without trusting the browser's.

**HR corrections.** `POST /records/:id/entries`, `PATCH /entries/:id`, `DELETE /entries/:id` each build
the *proposed* entry list, run `assertValidSequence()` on it, and only then write. A correction cannot
leave a day in a state the machine considers impossible.

**Day close.** `POST /attendance/mark-absences { date }`
([service.ts:254](ts-backend/src/modules/attendance/service.ts:254)) fills the gaps for a past or current
day (future dates are refused). For every employee who was employed on that date and has no record yet:

```
approved leave covers the day → ON_LEAVE
no schedule assigned         → skip (nothing to judge against)
not a working day            → WEEK_OFF
otherwise                    → ABSENT
```

It is idempotent (`skipped.hasRecord` counts the no-ops), does two bulk queries instead of per-employee
lookups, and returns `{ date, created: {ABSENT, ON_LEAVE, WEEK_OFF}, skipped: {hasRecord, noSchedule} }`.
There is no scheduler wired up — this is an HR-triggered endpoint today.

**The N+1 that isn't.** Derived fields need each row's schedule. A 20-row page across 20 employees would
be 20 extra queries, so `ScheduleCache` ([service.ts:40](ts-backend/src/modules/attendance/service.ts:40))
memoises **the promise** of each employee's assignment list and resolves dates in memory. One query per
distinct employee per request, and concurrent `Promise.all` callers share the same in-flight query.

### 9.3 Contracts

An interval table with an overlap rule: an employee may not have two `ACTIVE` contracts covering the same
day. `assertNoOverlap()` treats a null `end_date` as `9999-12-31`, so open-ended contracts collide
correctly. `EXPIRED` and `TERMINATED` rows are excluded — history is allowed to overlap, only current
truth must be unique.

Three behaviours worth knowing:

- **`expireContracts()`** flips `ACTIVE` rows whose `end_date` has passed to `EXPIRED` in one
  `updateMany`. It is called at the top of `list()` and `get()`, so status is correct without a cron job.
  Idempotent, so calling it on every read is harmless.
- **`getActiveContract(employeeId, date)`** — the single resolver for "what were this person's terms on
  that day". Payroll (phase 3+) must reuse it rather than re-deriving the rule.
- **`isCurrent`** is added at presentation time (`ACTIVE` **and** the date range covers today), so the UI
  never compares dates itself.

Creating a contract with a past `end_date` is stored as `EXPIRED` rather than rejected; `currency`
defaults to `env.DEFAULT_CURRENCY`; `created_by` is stamped from the actor. `terminate` requires the
contract to be `ACTIVE` and sets `end_date` to the supplied date or today.

### 9.4 Time off — the transactional core

[time-off/service.ts](ts-backend/src/modules/time-off/service.ts) is where the most rules meet. Creating a
request runs five checks, four of them inside one transaction:

1. **Scope** — `requireEmployeeScope()`: an employee may only file for themselves (403 otherwise); HR may
   file on anyone's behalf but must name them.
2. **Same calendar year** — a request spanning 31 Dec → 1 Jan is refused with a specific message, because
   balances are per year and splitting the deduction would be ambiguous. This is a *stated simplification*,
   not an oversight.
3. **No overlap** — any `PENDING` or `APPROVED` request intersecting the range is a 409, with the
   conflicting rows in `details.conflicts`. `REJECTED`/`CANCELLED` rows are ignored.
4. **`total_days` is computed, never accepted from the client** — `countWorkingDays()` over the employee's
   schedule on the start date. A Sat–Sun request on a Mon–Fri schedule yields 0 working days and is
   refused with *"the selected dates contain no working days for this employee"*.
5. **Balance** — see below.

**The balance check is the subtle one.** `assertBalance()` compares the request against
*available*, not *remaining*:

```
remaining = allocated + carriedForward − used        (approved leave only)
pending   = Σ total_days of the employee's PENDING requests for that type/year
available = remaining − pending
```

Without subtracting `pending`, someone could stack five 20-day requests against a 20-day allowance and
have them all pass validation, then have HR approve them one by one. On update and approve the request's
**own** days are excluded (`excludeRequestId`) so it is not counted against itself.

Leave types with `default_annual_days = 0` (e.g. *Unpaid Leave*) have **no balance row and no check** —
`getOrCreateBalance()` returns `null` and validation passes. This is how unpaid/unlimited categories work
without a special case in the rules.

**Decisions.** `approve()` runs in one transaction: re-read the request (must still be `PENDING`),
re-check the balance, insert the `time_off_approvals` row stamped with the reviewer, `increment used_days`,
and set the request `APPROVED`. Re-checking inside the transaction matters — the balance may have changed
between filing and approval. `reject()` is the same minus the balance work. The 1:1 unique constraint on
`time_off_request_id` means a request can never accumulate two decisions.

**Cancellation** is asymmetric by design: the owner or HR may cancel a `PENDING` request; only HR may
cancel an `APPROVED` one, and doing so **restores** `used_days` (floored at 0). Anything already
`REJECTED`/`CANCELLED` is a 422.

### 9.5 Leave balances — the one stored aggregate, with a safety net

`used_days` is the single exception to "derive everything", because it is written by an approval and read
by every subsequent validation; recomputing it from scratch on every check would be a `groupBy` per
request. Everything around it is still derived at read time — `remainingDays`, `pendingDays`,
`availableDays` are added by `presentBalance()` and never stored.

Because it is stored, it can drift (a bad migration, a manual `UPDATE`, a future bug). So:

- **`POST /leave-balances/recompute`** recomputes `used_days` from the sum of `APPROVED` requests per
  (employee, type, year), reports every difference as `{ leaveBalanceId, from, to }`, and fixes them in one
  transaction. Running it should be a no-op — the smoke suite asserts `corrected === 0`.
- **`POST /leave-balances/initialize { year, carryForward?, employeeIds? }`** creates the year's rows for
  active employees from each leave type's `default_annual_days`, optionally carrying forward the previous
  year's remaining into `carried_forward_days`. It skips rows that already exist, so it is safe to re-run.
- **`getOrCreateBalance()`** lazily creates a missing row from the type default when a request needs it, so
  a new hire mid-year does not need `initialize` to have been run first.

`GET /leave-balances/me?year=` is the employee's own view; the HR list is the same shape with filters. Both
batch the pending-days `groupBy` per year rather than per row.

### 9.6 Employees and users — two records, one person

`employees` is the HR record, `users` is the login. They are 1:1-optional: an employee can exist without a
login (contractor, pre-onboarding), and `users.employee_id` is unique so nobody gets two.

Guards in [employees/service.ts](ts-backend/src/modules/employees/service.ts):

- department and manager foreign keys are checked up front so the API returns
  *"Manager (employee) 42 not found"* rather than a raw FK error;
- an employee cannot be their own manager (422), and a `TERMINATED` employee cannot be someone's manager;
- **you cannot terminate or delete your own employee record** — the actor is compared to the target;
- termination is one transaction: set `TERMINATED` + `termination_date`, close all `ACTIVE` contracts to
  that date, close all open schedule assignments to that date, deactivate the login and revoke its refresh
  tokens. One call leaves no dangling open interval;
- `DELETE /employees/:id` is a **hard** delete (cascades to user, contracts, attendance, balances,
  requests) and is refused if the employee still manages anyone.

`GET /employees/:id/summary` is the profile page in one round trip: the employee, counts of
contracts/attendance/requests/pending-requests/balances/direct-reports, the current contract and the
current schedule — nine queries fired concurrently with `Promise.all`.

**Schedule assignments** get a nicety: `POST /employees/:id/schedule-assignments` with
`closePrevious: true` auto-closes the currently open assignment to the day before the new one starts,
inside a transaction. Without that flag any overlap is a 409 listing the conflicts. So "move Priya to the
early shift from Monday" is one call, and the history stays a clean non-overlapping timeline.

**Users** ([users/service.ts](ts-backend/src/modules/users/service.ts)) — `password_hash` is stripped from
every response by destructuring, not by remembering to omit it. Creating a login refuses a terminated
employee or a second account. Two self-lockout guards: you cannot change your own role and you cannot
deactivate your own account (both 422) — otherwise the only HR manager could demote themselves and nobody
could administer the system.

### 9.7 Master data

`departments`, `leave_types`, `work_schedules` are plain CRUD with **referential refusals** instead of
cascades: a department with employees, a leave type with balances or requests, and a schedule with
assignments all refuse deletion with a 422 that names the count. Each list adds derived counts
(`employeeCount`, `balanceCount`, `requestCount`, `assignmentCount`) so the UI can disable a delete button
before the user clicks it. `leave_types` also exposes `requiresBalance` (= `default_annual_days > 0`),
which is the flag the request form uses to decide whether to show a balance.

---

## 10. Derived vs stored, at a glance

| Value | Stored? | Computed from |
|---|---|---|
| `work_schedules.weekly_hours` | cached | `days × (end − start)`, rewritten on save, recomputed if null |
| daily / expected hours | no | `dailyHours(schedule)` |
| worked, break, overtime hours | no | punch pairs vs schedule |
| `isLate`, `lateByMinutes` | no | first clock-in vs `start_time + LATE_GRACE_MINUTES` |
| `missingCheckout` | no | open state + date < today |
| attendance `status` | yes | punches set `PRESENT`; day-close writes `ABSENT`/`WEEK_OFF`/`ON_LEAVE` |
| `time_off_requests.total_days` | yes | computed by the service at write time from the schedule (never client-supplied) |
| `leave_balances.used_days` | **yes** | maintained transactionally on approve/cancel; `recompute` is the audit |
| `remaining` / `pending` / `available` days | no | `allocated + carried − used`, minus pending |
| contract `isCurrent` | no | `ACTIVE` + range covers today |
| contract `EXPIRED` | yes | `expireContracts()` on read, idempotent |
| `permissions[]` on a user | no | `ROLE_PERMISSIONS[role]` |

The pattern: **store events and decisions, derive summaries.** Anything a rule change should retroactively
correct is derived; anything that records "a human decided this" is stored.

<!--APPEND-->
