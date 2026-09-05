"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { ListQuery } from "@/lib/api";

/**
 * The URL is the single source of truth for every list screen.
 *
 * `DataTable`, `FilterBar` and `Pagination` all read one of these objects, so a
 * screen wires them together by passing `list` to each and spreading
 * `list.params` into its query. Keeping the state in the URL (rather than in
 * `useState`) is what makes a filtered table shareable, reloadable and
 * survivable across the Back button — the gate FE-6 is measured against.
 *
 * The five reserved keys mirror `paginationSchema` in `src/lib/http.ts`
 * (`page ≥ 1`, `pageSize 1…100`, `sort`, `order`, `q`); anything else in the
 * query string is treated as a module filter and handed back through `filters`.
 * Values equal to the defaults are dropped from the URL, so the tidy
 * `/employees` stays `/employees` rather than growing five redundant params.
 *
 * Callers of a page that uses this hook must sit inside a `<Suspense>`
 * boundary: `useSearchParams()` opts a prerendered client component into
 * request-time rendering, and Next asks for the boundary explicitly.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZES = [10, 20, 50, 100] as const;

const RESERVED = new Set(["page", "pageSize", "sort", "order", "q"]);

export type SortOrder = "asc" | "desc";

/** Spreadable straight into a module's list query — a superset of `ListQuery`. */
export interface ListParams extends ListQuery {
  page: number;
  pageSize: number;
  sort?: string;
  order: SortOrder;
  q?: string;
}

/** A URL value: `null` and `""` delete the key rather than writing an empty one. */
export type ParamValue = string | number | null | undefined;

export interface ListParamsApi {
  params: ListParams;
  /** Every non-reserved query param, for filters the screen declares itself. */
  filters: Record<string, string>;
  setParams: (patch: Partial<ListParams>) => void;
  setFilter: (key: string, value: ParamValue) => void;
  setFilters: (patch: Record<string, ParamValue>) => void;
  /** First click sorts ascending; clicking the sorted column flips it. */
  toggleSort: (key: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (q: string) => void;
  /** Back to the defaults: drops filters, search, sort and paging together. */
  reset: () => void;
  /** True when the URL carries anything but the defaults. */
  isFiltered: boolean;
}

export interface ListParamsOptions {
  /** Column the API should sort by until the user picks another. */
  sort?: string;
  order?: SortOrder;
  pageSize?: number;
}

function toInt(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

export function useListParams(options: ListParamsOptions = {}): ListParamsApi {
  const { sort: defaultSort, order: defaultOrder = "asc", pageSize: defaultPageSize = DEFAULT_PAGE_SIZE } = options;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const params = useMemo<ListParams>(() => {
    const order = search.get("order");
    return {
      page: toInt(search.get("page"), 1, 1, Number.MAX_SAFE_INTEGER),
      pageSize: toInt(search.get("pageSize"), defaultPageSize, 1, 100),
      sort: search.get("sort") ?? defaultSort,
      order: order === "asc" || order === "desc" ? order : defaultOrder,
      q: search.get("q") ?? undefined,
    };
  }, [search, defaultSort, defaultOrder, defaultPageSize]);

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, value] of search.entries()) {
      if (!RESERVED.has(key) && value !== "") out[key] = value;
    }
    return out;
  }, [search]);

  /**
   * One writer for the whole hook. Anything other than an explicit `page` sends
   * the reader back to page 1 — a filter that narrowed the result set to two
   * rows while the URL still said `page=4` would otherwise show an empty table.
   */
  const apply = useCallback(
    (patch: Record<string, ParamValue>, replace = false) => {
      const next = new URLSearchParams(search.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in patch)) next.delete("page");
      if (next.get("page") === "1") next.delete("page");
      if (next.get("order") === defaultOrder) next.delete("order");
      if (next.get("pageSize") === String(defaultPageSize)) next.delete("pageSize");
      if (defaultSort && next.get("sort") === defaultSort) next.delete("sort");

      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      // `scroll: false`: paging a long table should not throw the reader back to the top.
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [search, pathname, router, defaultOrder, defaultPageSize, defaultSort],
  );

  return {
    params,
    filters,
    isFiltered: [...search.keys()].length > 0,
    setParams: useCallback((patch: Partial<ListParams>) => apply({ ...patch }), [apply]),
    setFilter: useCallback((key: string, value: ParamValue) => apply({ [key]: value }), [apply]),
    setFilters: useCallback((patch: Record<string, ParamValue>) => apply(patch), [apply]),
    setPage: useCallback((page: number) => apply({ page }), [apply]),
    setPageSize: useCallback((pageSize: number) => apply({ pageSize }), [apply]),
    setSearch: useCallback((q: string) => apply({ q: q.trim() || null }), [apply]),
    toggleSort: useCallback(
      (key: string) =>
        apply({ sort: key, order: params.sort === key && params.order === "asc" ? "desc" : "asc" }),
      [apply, params.sort, params.order],
    ),
    reset: useCallback(() => router.push(pathname, { scroll: false }), [router, pathname]),
  };
}
