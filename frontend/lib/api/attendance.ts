import { queryOptions } from "@tanstack/react-query";

import { http } from "./client";
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  DateString,
  ListQuery,
  Paginated,
} from "./types";

/** The `toOrderBy` allow-list in `src/modules/attendance/service.ts`. */
export const ATTENDANCE_SORTS = ["attendanceDate", "status", "createdAt"] as const;

export type ListRecordsQuery = ListQuery & {
  employeeId?: number;
  date?: DateString;
  from?: DateString;
  to?: DateString;
  status?: AttendanceStatus;
};

/** The four self-service punches, as their route segments. */
export const PUNCHES = ["clock-in", "clock-out", "break-start", "break-end"] as const;
export type Punch = (typeof PUNCHES)[number];

export interface MarkAbsencesResult {
  date: DateString;
  created: { ABSENT: number; ON_LEAVE: number; WEEK_OFF: number };
  skipped: { hasRecord: number; noSchedule: number };
}

export interface EntryBody {
  entryType: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
  /** A full ISO instant — this is a timestamp, not a date. */
  entryTime: string;
  source?: "WEB" | "MOBILE_APP" | "BIOMETRIC" | "MANUAL";
}

export const attendanceKeys = {
  all: ["attendance"] as const,
  session: ["attendance", "session"] as const,
  list: (query: ListRecordsQuery) => ["attendance", "list", query] as const,
  detail: (id: number) => ["attendance", "detail", id] as const,
};

export const attendance = {
  /**
   * Today's punch state for the widget. `staleTime: 0` because a punch made in another
   * tab (or a break that has since ended) must not be served from cache, and the
   * derived `elapsedMinutes` is only true at the moment it was computed.
   */
  session: () =>
    queryOptions({
      queryKey: attendanceKeys.session,
      queryFn: ({ signal }) => http.get<AttendanceSession>("/attendance/session", { signal }),
      staleTime: 0,
    }),

  list: (query: ListRecordsQuery = {}) =>
    queryOptions({
      queryKey: attendanceKeys.list(query),
      queryFn: ({ signal }) =>
        http.get<Paginated<AttendanceRecord>>("/attendance/records", { query, signal }),
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: attendanceKeys.detail(id),
      queryFn: ({ signal }) =>
        http.get<AttendanceRecord>(`/attendance/records/${id}`, { signal }),
    }),

  /**
   * Every punch answers with the same shape as `GET /attendance/session`, so the
   * response can be written straight into the session cache.
   *
   * An out-of-order punch (a second clock-in, a break end with no break) is a 422
   * `BUSINESS_RULE_VIOLATION` whose message names the current state — show it verbatim.
   */
  punch: (action: Punch) =>
    http.post<AttendanceSession>(`/attendance/${action}`, { source: "WEB" }),

  // ---- HR corrections (P2-5) ----

  createRecord: (body: {
    employeeId: number;
    attendanceDate: DateString;
    status?: AttendanceStatus;
    notes?: string | null;
    entries?: EntryBody[];
  }) => http.post<AttendanceRecord>("/attendance/records", body),

  updateRecord: (
    id: number,
    body: { attendanceDate?: DateString; status?: AttendanceStatus; notes?: string | null },
  ) => http.patch<AttendanceRecord>(`/attendance/records/${id}`, body),

  removeRecord: (id: number) => http.delete<void>(`/attendance/records/${id}`),

  /** The API stamps `source: MANUAL` by default on these three. */
  addEntry: (recordId: number, body: EntryBody) =>
    http.post<AttendanceRecord>(`/attendance/records/${recordId}/entries`, body),

  updateEntry: (entryId: number, body: Partial<EntryBody>) =>
    http.patch<AttendanceRecord>(`/attendance/entries/${entryId}`, body),

  removeEntry: (entryId: number) => http.delete<AttendanceRecord>(`/attendance/entries/${entryId}`),

  /** Idempotent: re-running it reports the rows it skipped instead of duplicating them. */
  markAbsences: (date: DateString) =>
    http.post<MarkAbsencesResult>("/attendance/mark-absences", { date }),
};
