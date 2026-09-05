import { format, parseISO } from "date-fns";

import type { RoleName } from "@/lib/api/types";

const ROLE_LABELS: Record<RoleName, string> = {
  EMPLOYEE: "Employee",
  HR_MANAGER: "HR Manager",
  HR_PAYROLL_USER: "HR Payroll User",
  HR_PAYROLL_MANAGER: "HR Payroll Manager",
  ADMIN: "Admin",
};

export function formatRoleName(role: RoleName): string {
  return ROLE_LABELS[role];
}

/**
 * Display formatting shared by the widget, the tables and the forms.
 *
 * The date helpers exist because of one API detail worth knowing: a **date-only**
 * column (`attendanceDate`, `hireDate`, a leave request's `startDate`) is a Prisma
 * `DateTime` pinned to UTC midnight, so it reaches the browser as
 * `"2026-09-05T00:00:00.000Z"` — not as `"2026-09-05"`. Reading such a value with
 * `new Date(…).toLocaleDateString()` shifts it to the previous day everywhere west of
 * UTC, and the API's own filters (`?date=`, `?from=`) only accept `YYYY-MM-DD`. So
 * date-only values are cut to their first ten characters and never time-zone-converted;
 * instants (`entryTime`, `createdAt`) are the opposite and *are* shown in local time.
 */

/** `"2026-09-05T00:00:00.000Z"` → `"2026-09-05"`, which is what the API's filters take. */
export function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

/** Today in the browser's own calendar, as the API wants it. */
export function todayDateOnly(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Date-only value → "05 Sep 2026". */
export function formatDate(value: string): string {
  return format(parseISO(toDateOnly(value)), "dd MMM yyyy");
}

/** Instant → "14:05" in the reader's own time zone. */
export function formatTime(value: string): string {
  return format(parseISO(value), "HH:mm");
}

/** Instant → "05 Sep 2026, 14:05". */
export function formatDateTime(value: string): string {
  return format(parseISO(value), "dd MMM yyyy, HH:mm");
}

/** `5` → "5m", `65` → "1h 05m". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

/** Decimal hours (`workedHours`, `overtimeHours`) in the same units as the punch timer. */
export function formatHours(hours: number): string {
  return formatMinutes(Math.round(hours * 60));
}

/** A decimal day count with no meaningless trailing zeroes. */
export function formatDays(days: number): string {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(days)} ${days === 1 ? "day" : "days"}`;
}

/** Money formatted in the contract's own currency. */
export function formatCurrency(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  if (!currency) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)}`;
  }
}
