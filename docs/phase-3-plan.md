# PeoplePay360 — Phase 3 Payroll Implementation Plan

> Covers role ③ `HR_PAYROLL_USER`: all `HR_MANAGER` capabilities plus payrun and payslip operations and read-only salary configuration.

**Decision date:** 2026-09-05  
**Implementation status:** ✅ **Implemented and verified in the combined Phase 1–3 gate on 2026-09-05.**  
**Schema status:** **Provisional and intentionally isolated.** No authoritative Phase 3/4 team SQL was available. Per `docs/build-plan.md` P3-0, this phase proceeds from the placeholder in `docs/overall-implementation-plan.md` and records the complete contract here before implementation. All payroll tables land in one additive migration so they can be compared with, or replaced by, a later team schema without changing the Phase 1–2 migration.

This document is the Phase 3 source of truth for schema, lifecycle, calculation, API, and screen behavior. The MySQL/Prisma translation rules in `docs/phase-1-plan.md` §4.1 still apply.

---

## 1. Scope and access

| Role | Phase 3 access |
|---|---|
| `EMPLOYEE` | Unchanged. No payroll endpoints or navigation. Payslip services are nevertheless employee-scope-safe for a later permission flip. |
| `HR_MANAGER` | Unchanged. No payroll permissions. |
| `HR_PAYROLL_USER` | Exact `HR_MANAGER` permission set plus payroll read, payrun write, payslip write, and salary-configuration read. Sees all employees. |
| `HR_PAYROLL_MANAGER` | Enum/database row only in this migration. Not assignable and receives no permissions until Phase 4. |
| `ADMIN` | Enum/database row only in this migration. Not assignable and receives no permissions until Phase 5. |

Phase 3 includes:

- Read-only salary structures and ordered salary rules.
- Payrun eligibility, selected-employee creation, calculation, warnings, validation, payment, cancellation, and payslip sending.
- Payslip list/detail, recomputation while mutable, PDF generation, and authenticated download.
- A representative structure, payroll user, bank details, computed payrun, smoke coverage, and all corresponding frontend routes.

Phase 3 excludes:

- Salary structure/rule create, edit, delete, or reorder (Phase 4).
- Payroll hard-delete (Phase 4; only a `DRAFT` payrun will be eligible).
- Payroll dashboard and analytics (Phase 4).
- Employee self-service payslip access (a later permission change).
- Cross-currency calculation or exchange rates.
- Contract pay frequencies. Existing `contracts.base_salary` is the period wage input.

---

## 2. Architecture decisions

1. **The salary structure belongs to the payrun, not the contract.** The two-step wizard chooses a structure, and each run snapshots its currency. This avoids retroactively changing historical runs when an employee or contract changes.
2. **Rules belong directly to one structure.** `salary_rules.salary_structure_id` is a one-to-many relation. No join table is introduced because order and computation settings are structure-specific and there is no rule-sharing requirement.
3. **History is snapshotted.** A payslip stores contract wage, currency, derived inputs, category totals, and computation time. Each payslip line stores the rule identity and all computation operands as they existed when calculated. Later configuration edits cannot alter history.
4. **Payslip status is derived from its payrun.** There is no duplicate payslip status column that could drift from `payruns.status`.
5. **Money uses decimal arithmetic.** Database money is `Decimal(12,2)`. Engine intermediates use `Prisma.Decimal`; values written or returned are explicitly rounded to two decimal places.
6. **No implicit currency conversion.** A structure has one ISO-style three-character currency. A selected contract must use the same currency.
7. **Existing resolvers remain authoritative.** Payroll reuses `getActiveContract(employeeId, date)`, effective-dated schedule resolution, and `attendance/derive.ts`; it does not reimplement those rules.
8. **Unpaid leave uses the only existing signal.** An approved request is treated as unpaid when its leave type has `defaultAnnualDays == 0`. This provisional rule conflates genuinely unpaid leave with any unlimited paid leave represented by zero; a future schema should add an explicit paid/unpaid flag.
9. **Missing SMTP is deterministic and offline.** Nodemailer's JSON transport is the development fallback. The application does not create Ethereal accounts or make an outbound request.
10. **Configuration components are reusable.** Read-only structure/rule components take `editable={false}` so Phase 4 can turn editing on behind `salary-config:write` without replacing the views.

---

## 3. Data model

### 3.1 Enums

| Enum | Values | Meaning |
|---|---|---|
| `RoleName` | existing `EMPLOYEE`, `HR_MANAGER`; add `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` | All remaining role literals land in the single payroll migration. Permissions, not enum presence, release a role. |
| `SalaryRuleCategory` | `BASIC`, `ALLOWANCE`, `GROSS`, `DEDUCTION`, `NET` | Category totals exposed by the engine and payslip. Deduction line amounts are positive and subtracted by the NET rule. |
| `SalaryRuleMethod` | `FIXED`, `PERCENTAGE`, `FORMULA` | Exactly one matching operand set is valid. |
| `SalaryRuleBase` | `CONTRACT_WAGE`, `BASIC`, `GROSS` | Allowed base for percentage rules. |
| `PayrunStatus` | `DRAFT`, `COMPUTED`, `VALIDATED`, `PAID`, `CANCELLED` | The only persisted payroll lifecycle status. |

### 3.2 Tables

#### `salary_structures`

| Column | Prisma / MySQL shape | Rules |
|---|---|---|
| `salary_structure_id` | `Int`, auto-increment PK | |
| `name` | `VarChar(120)`, unique | Trimmed, non-empty. |
| `description` | nullable `Text` | |
| `currency` | `Char(3)` | Uppercase; no conversion is performed. |
| `is_active` | `Boolean`, default `true` | Inactive structures remain readable but cannot be selected for a new payrun. |
| `created_at` | `DateTime(3)`, default now | UTC. |
| `updated_at` | `DateTime(3)`, auto-update | UTC. |

Relations: one structure has ordered `salary_rules` and many `payruns`.

#### `salary_rules`

| Column | Prisma / MySQL shape | Rules |
|---|---|---|
| `salary_rule_id` | `Int`, auto-increment PK | |
| `salary_structure_id` | FK → `salary_structures` | Required, `Restrict` delete. |
| `name` | `VarChar(120)` | Human label. |
| `code` | `VarChar(50)`, globally unique | Uppercase identifier used by formulas. |
| `category` | `SalaryRuleCategory` | |
| `sequence` | `Int` | Positive and unique inside a structure. |
| `method` | `SalaryRuleMethod` | |
| `fixed_amount` | nullable `Decimal(12,2)` | Required only for `FIXED`. |
| `percentage` | nullable `Decimal(7,4)` | Required only for `PERCENTAGE`; interpreted as a percentage (for example `12` = 12%). |
| `percentage_base` | nullable `SalaryRuleBase` | Required only for `PERCENTAGE`. |
| `formula` | nullable `Text` | Required only for `FORMULA`; parsed, never evaluated as JavaScript. |
| `is_active` | `Boolean`, default `true` | Inactive rules remain readable and remain referenced by history, but are excluded from new computation. |
| `created_at` / `updated_at` | `DateTime(3)` | UTC. |

Constraints/indexes: global unique `code`; unique `(salary_structure_id, sequence)`; indexes on `(salary_structure_id, is_active)`, `category`.

Method invariant, enforced in validation and services:

- `FIXED`: `fixedAmount` set; percentage/base/formula null.
- `PERCENTAGE`: percentage and base set; fixed/formula null.
- `FORMULA`: formula set; fixed/percentage/base null.

#### `employee_bank_details`

| Column | Prisma / MySQL shape | Rules |
|---|---|---|
| `employee_bank_detail_id` | `Int`, auto-increment PK | |
| `employee_id` | unique FK → `employees` | One row per employee; delete cascades with employee only when payroll history does not otherwise restrict that employee deletion. |
| `account_holder_name` | `VarChar(150)` | |
| `bank_name` | `VarChar(150)` | |
| `account_number` | `VarChar(64)` | Stored as text so leading zeroes survive. Not exposed by salary list endpoints. |
| `routing_code` | `VarChar(64)` | Supports IFSC/routing/SWIFT-style values without assuming one country. |
| `branch_name` | nullable `VarChar(150)` | |
| `created_at` / `updated_at` | `DateTime(3)` | UTC. |

Phase 3 has no bank-detail CRUD endpoint; these rows support warning generation and representative seed data.

#### `payruns`

| Column | Prisma / MySQL shape | Rules |
|---|---|---|
| `payrun_id` | `Int`, auto-increment PK | |
| `salary_structure_id` | FK → `salary_structures` | `Restrict` delete. |
| `name` | `VarChar(150)` | Searchable; not globally unique because period/name conventions may repeat. |
| `period_start`, `period_end` | `Date` | Inclusive; end must be on/after start. |
| `currency` | `Char(3)` | Structure currency snapshot. |
| `status` | `PayrunStatus`, default `DRAFT` | |
| `created_by` | FK → `employees` | Required actor, `Restrict` delete. |
| `computed_at` | nullable `DateTime(3)` | Replaced on successful full compute. |
| `validated_by`, `validated_at` | nullable FK / timestamp | Set together on validation. |
| `paid_by`, `paid_at` | nullable FK / timestamp | Set together on mark-paid. |
| `cancelled_by`, `cancelled_at`, `cancel_reason` | nullable FK / timestamp / `VarChar(500)` | Set together on cancellation; reason required by API. |
| `created_at`, `updated_at` | `DateTime(3)` | UTC. |

Indexes: `(status, period_start, period_end)`, `salary_structure_id`, and each actor FK. Period ranges are intentionally not unique; duplicate protection is employee/payslip based.

#### `payslips`

| Column | Prisma / MySQL shape | Rules |
|---|---|---|
| `payslip_id` | `Int`, auto-increment PK | |
| `payrun_id` | FK → `payruns` | Payrun deletion cascades to payslips; service-level hard delete is reserved for Phase 4 and DRAFT only. |
| `employee_id` | FK → `employees` | `Restrict` delete to preserve payroll history. |
| `contract_id` | FK → `contracts` | `Restrict` delete. Contract resolved at period end. |
| `contract_wage` | `Decimal(12,2)` | Snapshot of `contracts.base_salary`. |
| `currency` | `Char(3)` | Contract/structure currency snapshot. |
| `expected_days`, `worked_days`, `unpaid_days` | `Decimal(7,2)`, default `0` | Input snapshots. |
| `expected_hours`, `worked_hours` | `Decimal(9,2)`, default `0` | Input snapshots. |
| `basic`, `allowances`, `gross`, `deductions`, `net` | `Decimal(12,2)`, default `0` | Category total snapshots. |
| `computed_at` | nullable `DateTime(3)` | Null means the shell has not been successfully computed. |
| `created_at`, `updated_at` | `DateTime(3)` | UTC. |

Constraints/indexes: unique `(payrun_id, employee_id)`; indexes on `employee_id`, `contract_id`, and `computed_at`. Status and period are joined from the payrun.

#### `payslip_lines`

| Column | Prisma / MySQL shape | Rules |
|---|---|---|
| `payslip_line_id` | `Int`, auto-increment PK | |
| `payslip_id` | FK → `payslips` | Cascade delete. |
| `salary_rule_id` | FK → `salary_rules` | `Restrict` delete. |
| `rule_name`, `rule_code` | `VarChar(120)`, `VarChar(50)` | Display/identifier snapshots. |
| `category` | `SalaryRuleCategory` | Snapshot. |
| `sequence` | `Int` | Snapshot and display order. |
| `method` | `SalaryRuleMethod` | Snapshot. |
| `fixed_amount` | nullable `Decimal(12,2)` | Operand snapshot. |
| `percentage` | nullable `Decimal(7,4)` | Operand snapshot. |
| `percentage_base` | nullable `SalaryRuleBase` | Operand snapshot. |
| `formula` | nullable `Text` | Operand snapshot. |
| `amount` | `Decimal(12,2)` | Computed result. |
| `created_at` | `DateTime(3)`, default now | UTC. |

Constraints/indexes: unique `(payslip_id, sequence)` and `(payslip_id, salary_rule_id)`; indexes on `salary_rule_id` and `(payslip_id, category)`.

### 3.3 Existing-model relations

- `Employee`: optional bank detail; many payslips; payruns created/validated/paid/cancelled through separately named actor relations.
- `Contract`: many historical payslips.
- No salary-structure FK is added to contracts.

### 3.4 Delete behavior

- Historical `payslips` restrict deletion of referenced employees and contracts.
- Historical `payslip_lines` restrict deletion of referenced salary rules; payruns restrict deletion of structures.
- Payrun → payslip → line cascades exist at DB level for the later Phase 4 DRAFT-only hard-delete operation.
- Employee → bank details cascades.
- Phase 3 exposes no delete route for any payroll table.

---

## 4. Permissions and role release

Add four compile-time permissions:

| Permission | Use |
|---|---|
| `payroll:read` | Read payruns, warnings, payslips, and PDFs. |
| `payruns:write` | Create, compute, validate, mark paid, cancel, and send. |
| `payslips:write` | Recompute one mutable payslip. |
| `salary-config:read` | Read structures and rules. |

The existing `HR_MANAGER` set must be copied/frozen before adding payroll permissions. `HR_PAYROLL_USER` is `HR_MANAGER +` the four permissions. `canSeeAllEmployees()` includes both roles. `EMPLOYEE` is unchanged.

Although all five role rows are seeded idempotently, only `EMPLOYEE`, `HR_MANAGER`, and `HR_PAYROLL_USER` are assignable/returned for account management in Phase 3. `HR_PAYROLL_MANAGER` and `ADMIN` have empty permission sets and cannot be assigned until their phases release them.

Representative login: existing Finance Controller **Vikram Singh**, username `vikram.singh@oxp.com`, receives `HR_PAYROLL_USER`. Its password follows the existing seed credential contract.

---

## 5. Calculation inputs

For each selected employee and inclusive payrun period:

1. Resolve the active contract at `periodEnd`. `baseSalary` is `contractWage` for this pay period.
2. Resolve the effective work schedule for each date because assignments can change during a period.
3. `expectedDays`: number of dates that are working days according to the resolved schedule.
4. `expectedHours`: sum of each working date's schedule hours.
5. Load attendance records/entries in the period and call the existing `derive()` with that date's schedule.
6. `workedHours`: sum valid derived worked hours.
7. `workedDays`: sum `min(1, workedHoursForDate / expectedHoursForDate)` for working dates with positive expected hours, rounded to two decimals. Non-working attendance contributes hours but not a worked-day fraction.
8. `unpaidDays`: working dates covered by an `APPROVED` time-off request whose leave type has `defaultAnnualDays == 0`.
9. Persist these values and the contract wage/currency on successful computation.

The engine receives plain named inputs:

`contractWage`, `expectedDays`, `workedDays`, `expectedHours`, `workedHours`, `unpaidDays`.

Currency is metadata and cannot participate in arithmetic.

---

## 6. Safe rule engine

### 6.1 Execution

- Load active rules ordered by `sequence`; duplicate sequences are impossible by DB constraint.
- Evaluate one rule at a time. Only previous rule codes/category totals are visible.
- `FIXED`: amount = `fixedAmount`.
- `PERCENTAGE`: amount = selected base × (`percentage / 100`). Bases are contract wage, accumulated BASIC, or accumulated GROSS.
- `FORMULA`: parse and evaluate the restricted grammar below.
- Round every line result to two decimal places before making it visible to later rules.
- Accumulate category totals from rounded lines.
- Return ordered lines and totals: `basic`, `allowances`, `gross`, `deductions`, `net`.

### 6.2 Formula grammar

Allowed:

- Decimal numbers.
- Unary `+` and `-`.
- Binary `+`, `-`, `*`, `/` with normal precedence.
- Parentheses.
- Functions `min(a, b, ...)`, `max(a, b, ...)`, and `round(value[, decimalPlaces])`.
- Plain input identifiers from the exact input list.
- `categories['BASIC']`, `categories['ALLOWANCE']`, `categories['GROSS']`, `categories['DEDUCTION']`, `categories['NET']`.
- `rules['CODE']` for an already evaluated active rule.

Rejected:

- Unknown identifiers, categories, functions, or rule codes.
- A reference to the current or a later rule.
- Arbitrary property access, method calls, assignments, template strings, comments, semicolons, object/array literals, and executable JavaScript.
- Division by zero, invalid function arity, non-integer/unsupported round precision, non-finite values, or trailing tokens.

The implementation is a tokenizer plus recursive-descent parser. `eval`, `Function`, dynamic imports, and third-party JavaScript evaluators are forbidden.

### 6.3 Representative structure

`Regular Salary` (`INR`) uses this sequence:

| Seq | Code | Category | Method | Definition |
|---:|---|---|---|---|
| 10 | `BASIC` | BASIC | FORMULA | `round(contractWage * max(0, expectedDays - unpaidDays) / expectedDays, 2)` |
| 20 | `HRA` | ALLOWANCE | PERCENTAGE | 40% of BASIC |
| 30 | `STANDARD_ALLOWANCE` | ALLOWANCE | FIXED | 2,000.00 |
| 40 | `GROSS` | GROSS | FORMULA | `categories['BASIC'] + categories['ALLOWANCE']` |
| 50 | `PF` | DEDUCTION | PERCENTAGE | 12% of BASIC |
| 60 | `PROFESSIONAL_TAX` | DEDUCTION | FIXED | 200.00 |
| 70 | `ESIC` | DEDUCTION | PERCENTAGE | 0.75% of GROSS |
| 80 | `NET` | NET | FORMULA | `categories['GROSS'] - categories['DEDUCTION']` |

A missing/zero expected-day basis is a computation error, not an invented fallback.

---

## 7. Eligibility and lifecycle

### 7.1 Eligibility

`GET /payruns/eligible-employees` returns every `ACTIVE` employee matching the optional contract-type filter, including rows that cannot be selected so the wizard can explain why.

A row is selectable only when:

- an active contract resolves at period end;
- `baseSalary` is non-null and positive;
- contract currency equals the selected active structure currency; and
- no non-cancelled payrun already contains that employee in a payslip whose period overlaps the requested period.

No-contract, salary, currency, and duplicate cases are flagged with machine-readable reasons instead of being hidden. Duplicate overlap is therefore visible but non-selectable. `POST /payruns` repeats every check server-side and accepts only the explicitly selected employee IDs.

### 7.2 State machine

```text
DRAFT ──compute──> COMPUTED ──validate──> VALIDATED ──mark-paid──> PAID
  │                    │                      │
  └────cancel───────────┴────cancel───────────┘──> CANCELLED
```

- `DRAFT`: shells exist; full compute or one-payslip recompute allowed.
- `COMPUTED`: all payslips successfully computed; full or one-payslip recompute allowed.
- `VALIDATED`: immutable payroll history; sending allowed.
- `PAID`: terminal immutable history; sending allowed.
- `CANCELLED`: terminal and excluded from duplicate eligibility checks.
- Cancellation is accepted from DRAFT, COMPUTED, or VALIDATED and requires a reason.
- Every out-of-order transition returns 422.

Full compute runs in one transaction, replaces all existing lines, refreshes snapshots/totals, and ends as `COMPUTED`. Repeating it with unchanged source data is idempotent. A computation error rolls the transaction back rather than leaving a partly recomputed run.

Validation requires status `COMPUTED`, every payslip computed, and zero hard warnings. Mark-paid requires `VALIDATED`. Sending requires `VALIDATED` or `PAID` and does not change lifecycle state.

---

## 8. Warning catalogue

Warnings have a stable `code`, `severity` (`HARD` or `SOFT`), message, and optional `employeeId`/`payslipId`/details.

### Hard — block validation

| Code | Condition |
|---|---|
| `MISSING_CONTRACT` | No active contract at period end. |
| `MISSING_BASE_SALARY` | Contract salary is null/non-positive. |
| `CURRENCY_MISMATCH` | Contract and structure/payrun currencies differ. |
| `MISSING_SCHEDULE` | Any required period date cannot resolve a schedule. |
| `INVALID_ATTENDANCE` | Existing attendance entries form an invalid sequence. |
| `MISSING_CHECKOUT` | A period attendance record has an unclosed session. |
| `RULE_COMPUTE_ERROR` | Formula/operand/decimal calculation fails. |
| `DUPLICATE_PAYSLIP` | Employee has an overlapping payslip in another non-cancelled payrun. |
| `NOT_COMPUTED` | A shell has no successful computation timestamp/lines. |
| `NON_POSITIVE_NET` | Computed net is zero or negative. |

### Soft — shown but do not block validation

| Code | Condition |
|---|---|
| `MISSING_BANK_DETAILS` | Employee has no bank-detail row. |
| `MISSING_ATTENDANCE` | A scheduled workday has no attendance row and is not covered by approved leave. |
| `PARTIAL_PERIOD_CONTRACT` | Contract starts after period start or ends before period end, although it resolves at period end. |
| `ZERO_WORKED_HOURS` | Total worked hours is zero. |

Warnings are recomputed from current data on request. Snapshot/history fields remain unchanged until an allowed recompute.

---

## 9. API surface (`/api/v1`)

All routes require authentication and preserve the existing list/error envelope conventions. `P` below means `HR_PAYROLL_USER` in Phase 3.

### 9.1 Salary configuration — read-only

| Endpoint | Query/body and response | Permission |
|---|---|---|
| `GET /salary-structures` | `page`, `pageSize`, `q`, `active`, `sort`, `order`; structure rows with `ruleCount`. | `salary-config:read` |
| `GET /salary-structures/:id` | Structure plus all rules ordered by sequence. | `salary-config:read` |
| `GET /salary-rules` | `page`, `pageSize`, `q`, `structureId`, `category`, `active`, `sort`, `order`; includes structure summary. | `salary-config:read` |

There are no POST/PATCH/DELETE configuration routes in Phase 3.

### 9.2 Payruns

| Endpoint | Contract | Permission |
|---|---|---|
| `GET /payruns` | Filters `q`, `status`, `structureId`, `from`, `to`; list includes structure and payslip count/totals. | `payroll:read` |
| `GET /payruns/eligible-employees` | Required `structureId`, `from`, `to`; optional `contractType`, `q`; returns employee/contract summary, flags, and `selectable`. This is wizard step 2 and writes nothing. | `payroll:read` |
| `POST /payruns` | `{ name, structureId, periodStart, periodEnd, employeeIds[] }`; atomically creates one DRAFT and exactly one shell per selected employee. | `payruns:write` |
| `GET /payruns/:id` | Header/actors/timestamps, structure, aggregate totals, and payslip summaries. | `payroll:read` |
| `POST /payruns/:id/compute` | No body; DRAFT/COMPUTED only; returns refreshed detail. | `payruns:write` |
| `GET /payruns/:id/warnings` | `{ hard: Warning[], soft: Warning[], counts }`. | `payroll:read` |
| `POST /payruns/:id/validate` | No body; COMPUTED and no hard warnings. | `payruns:write` |
| `POST /payruns/:id/mark-paid` | No body; VALIDATED only. | `payruns:write` |
| `POST /payruns/:id/cancel` | `{ reason }`; DRAFT/COMPUTED/VALIDATED only. | `payruns:write` |
| `POST /payruns/:id/send-payslips` | No body; VALIDATED/PAID only; returns `{ results: [{ employeeId, payslipId, email, success, messageId?, error? }] }`. | `payruns:write` |

Static `/eligible-employees` is registered before `/:id`.

### 9.3 Payslips

| Endpoint | Contract | Permission |
|---|---|---|
| `GET /payslips` | Filters `q`, `employeeId`, `payrunId`, `status` (derived payrun status), `from`, `to`; list includes employee, structure, payrun, worked days, gross, net. | `payroll:read` + employee service scope |
| `GET /payslips/:id` | Identification block, input snapshots, ordered lines grouped by category, and totals. | `payroll:read` + employee service scope |
| `POST /payslips/:id/recompute` | DRAFT/COMPUTED payruns only; replaces this payslip's lines/totals in one transaction. | `payslips:write` + employee service scope |
| `GET /payslips/:id/pdf` | Streams `application/pdf` with an attachment filename; includes identification, period/structure, every line, and totals. | `payroll:read` + employee service scope |

An EMPLOYEE has no `payroll:read` in Phase 3, so employee self-service remains inaccessible even though row scoping is ready.

### 9.4 Mail environment

Optional validated values:

- `SMTP_HOST`
- `SMTP_PORT` (1–65535)
- `SMTP_SECURE` (boolean)
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

When `SMTP_HOST` is absent, use Nodemailer `jsonTransport`. When SMTP is configured, `MAIL_FROM` must be valid/non-empty and user/password must be supplied together. PDFKit and Nodemailer packages and their type packages are installed at exact versions.

---

## 10. Frontend contract

### 10.1 Routes

| Route | Content |
|---|---|
| `/payroll/payruns` | Search/filter list and two-step create wizard. |
| `/payroll/payruns/[id]` | Status-aware lifecycle actions, hard/soft warnings, payslip table, recompute links. |
| `/payroll/payslips` | Search, period/status filters, employee/run/structure/worked days/gross/net. |
| `/payroll/payslips/[id]` | Identification, inputs, ordered computation table/subtotals, authenticated PDF download. |
| `/payroll/structures` | Read-only structure list; component accepts `editable={false}`. |
| `/payroll/structures/[id]` | Read-only ordered rules and computation summaries. |
| `/payroll/rules` | Read-only rule list with structure/category/sequence/method summary. |

No Phase 3 payroll dashboard route is added.

### 10.2 Navigation and authorization

The existing Payroll group gains Payruns, Payslips, Salary Structures, and Salary Rules. Items are gated by permissions (`payroll:read` or `salary-config:read`), never role-name string comparisons. Buttons additionally require their write permission and an API-valid status.

### 10.3 Wizard behavior

1. Step 1 collects structure, inclusive period (month shortcut may fill from/to), and optional contract type. Continue performs only the eligibility GET.
2. Step 2 shows all returned ACTIVE employees, flags and selectability. Only selectable rows can be checked.
3. Create Payrun performs the sole POST with selected IDs, then navigates to the returned payrun.
4. Closing/backing out before Create writes no row. Deselecting a person creates no payslip for that person.

### 10.4 Next.js/client constraints

- Dynamic Next.js 16 route `params` are Promises and must be awaited/unwrapped accordingly.
- List routes that call `useSearchParams()` are rendered below an explicit `<Suspense>` boundary.
- Authenticated data remains in client-side TanStack Query; server components do not call bearer-protected APIs.
- Add typed modules `lib/api/payruns.ts`, `payslips.ts`, `salary-structures.ts`, and `salary-rules.ts` and export them through `lib/api/index.ts`.
- Direct browser anchors cannot attach the in-memory bearer token. The API client therefore gains authenticated blob/raw-response support that uses the same 401 refresh-and-single-retry path as JSON requests; PDF download uses that path and an object URL.

---

## 11. Seed and validation contract

Fresh seed data adds, idempotently and behind the existing dataset guard:

- All three remaining role rows but only one released payroll login (`vikram.singh@oxp.com`).
- `Regular Salary` and the eight rules in §6.3.
- Bank details for most, not all, active employees so the soft warning is demonstrable.
- One representative computed payrun for the previous calendar month with deterministic payslip lines and totals.

Phase 3 is complete only after the combined P1/P2/P3 gate passes:

1. Prisma client generation and schema validation.
2. Fresh MySQL migration deploy and idempotent seed.
3. Backend typecheck.
4. Unit tests, including engine fixed/percentage/formula, later-reference rejection, hostile input rejection, and rounding.
5. Expanded smoke: payroll login permission superset; HR_MANAGER payroll 403; salary reads; eligibility flags; selected-only creation; repeat compute; warnings; guarded transitions; recompute rules; PDF signature/content response; send fallback; existing checks remain green.
6. Frontend TypeScript and lint.
7. Next production build using the verified Webpack fallback (`npm run build -- --webpack`) if Turbopack again exits without a diagnostic.

Planning documents are marked complete only with command output evidence from that gate.

### 11.1 Verification evidence — 2026-09-05

The complete Phase 1–3 gate passed:

- Frontend: `npx tsc --noEmit` and `npm run lint` passed; Next.js **16.3.4** production build passed with `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run build -- --webpack`, including 23/23 static page generations and all seven payroll routes.
- Backend: `npm run prisma:generate` and `npm run typecheck` passed; `npm test` passed **81/81 tests in 5 files**, including all safe-engine parser, reference, rejection, and rounding cases.
- Database: fresh ephemeral MySQL **8.4.9** applied `20260905000000_init` and `20260905010000_phase_3_payroll`; it exposed 20 application tables plus `_prisma_migrations` (**21 total**).
- Seed: the representative seed completed, then completed a second time without duplicate data, proving the Phase 1–3 seed path remains idempotent.
- Live API: `npm run smoke` passed **84/84 checks**, including payroll RBAC boundaries, salary reads, flagged eligibility, selected-only creation, repeated compute, hard/soft warnings, lifecycle guards, payslip recompute/detail, `%PDF` streaming, JSON mail transport, paid immutability, and cancellation.
- Cleanup: the temporary API and ephemeral database processes were stopped after the gate.

No browser-only manual click-through was recorded. Compilation, generated routes, authorization, API workflows, migration/seed, PDF response, and mail fallback are machine-verified by the checks above.

---

## 12. Provisional deviations and future reconciliation

| Area | Provisional choice | Reconciliation note |
|---|---|---|
| Schema authority | Designed locally because team Phase 3/4 SQL is unavailable. | Compare every table/column/constraint when SQL arrives; keep any replacement in a later migration after environments have consumed this one. |
| Structure ownership | Payrun owns structure; contract does not. | If team SQL links contracts, preserve the run snapshot and define precedence explicitly. |
| Rule relation | Direct structure FK, no reusable rule join. | Introduce a mapping table only if true cross-structure sharing is required. |
| Pay frequency | `baseSalary` is the period wage. | Add frequency and normalization only from an authoritative contract schema. |
| Unpaid leave | `defaultAnnualDays == 0`. | Replace with explicit `is_paid`/deduction policy when available. |
| Bank data | One generic bank-detail row per employee; no CRUD in P3. | Encrypt/mask fields and add country-specific validation before production financial use. |
| Payslip status | Derived from payrun. | Keep unless an authoritative independent payslip lifecycle is supplied. |
| Formula language | Small deterministic grammar. | Version formulas before extending syntax so historical interpretation remains reproducible. |
| Delivery audit | Send returns a per-recipient report but is not persisted. | A later schema can add a delivery-attempt/audit table without changing payroll calculation. |
| Payroll cancel | Included because P3-5 requires it. | Phase 4 adds DRAFT hard-delete; cancel remains the auditable operation for later states. |
| Frontend builder | The default Turbopack attempt exited with code `-1` and no diagnostic on this Windows host; the documented Webpack fallback passed. | Keep `npm run build -- --webpack` as the production gate until the toolchain issue is resolved. |
| Dependency audit | `npm install` reported five findings (one moderate, four high). No breaking `npm audit fix --force` was applied. | Review and remediate dependencies separately with compatibility testing; do not hide the findings through an unreviewed force upgrade. |
