/**
 * One entry point for data access: `api.employees.list(…)` for reads (pass the
 * result to `useQuery`), `api.departments.create(…)` for writes.
 *
 * `http` and `ApiError` come from `./client` when a screen needs the wrapper
 * directly; nothing outside `lib/api` should call `fetch`.
 */

import { attendance } from "./attendance";
import { auth } from "./client";
import { departments } from "./departments";
import { employees } from "./employees";

export const api = { attendance, auth, departments, employees };

export { ApiError, hasAccessToken, http, onSessionEnded, refreshSession } from "./client";

/** The query keys, for `invalidateQueries` after a write. */
export { attendanceKeys } from "./attendance";
export { departmentKeys } from "./departments";
export { employeeKeys } from "./employees";

export type { ListRecordsQuery, MarkAbsencesResult, Punch } from "./attendance";
export type { ListEmployeesQuery } from "./employees";
export * from "./types";
