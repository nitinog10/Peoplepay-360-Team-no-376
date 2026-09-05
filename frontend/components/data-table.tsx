"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, RotateCwIcon } from "lucide-react";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListParamsApi } from "@/hooks/use-list-params";
import { ApiError, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * One table for the ~20 list screens, shaped around the API's `{ data, meta }`
 * envelope and the URL state in `useListParams`.
 *
 * Sorting, paging and page size are not held here — they live in the URL, so this
 * component reads `list.params` and calls back into the hook. That is what makes a
 * sorted, filtered, third page of a table survive a reload or a shared link.
 *
 * Four states, in the order they are checked: 403 → `<Forbidden />` (a retry button
 * would be a lie), any other error → message plus Retry, `isPending` → skeleton rows
 * under the real header so the layout does not jump, no rows → an empty state that
 * names the active search. A screen that pages a lot should pass
 * `placeholderData: keepPreviousData` to its query, which keeps the current rows on
 * screen (dimmed, via `isFetching`) instead of flashing skeletons on every page.
 */

export interface Column<T> {
  /**
   * Identity, and — when `sortable` — the `?sort=` value sent to the API, so it
   * must appear in that module's `toOrderBy` allow-list (e.g. `EMPLOYEE_SORTS`).
   */
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "start" | "end" | "center";
  /** The column appears from this breakpoint up, and is dropped below it. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * The parts of a TanStack `useQuery` result this needs. Structural rather than
 * `UseQueryResult<Paginated<T>>` so a caller can hand over its query object
 * whatever generics it was built with.
 */
export interface TableQuery<T> {
  data?: Paginated<T>;
  error: unknown;
  isPending: boolean;
  isFetching?: boolean;
  refetch: () => void;
}

export interface EmptyState {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  start: "text-left",
  end: "text-right",
  center: "text-center",
};

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

/** Static class lookups, never interpolation — Tailwind only sees literal strings. */
function columnClass<T>(column: Column<T>): string {
  return cn(column.align && ALIGN[column.align], column.hideBelow && HIDE[column.hideBelow], column.className);
}

function SortHeader({
  label,
  active,
  order,
  onClick,
}: {
  label: React.ReactNode;
  active: boolean;
  order: "asc" | "desc";
  onClick: () => void;
}) {
  const Icon = !active ? ChevronsUpDownIcon : order === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 outline-none hover:text-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
    </button>
  );
}

/**
 * The retry box a failed list shows. Exported because the Kanban view needs the
 * same one — a screen that can be read two ways must fail the same way in both.
 */
export function ListError({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-sm text-destructive">
        {error instanceof ApiError ? error.message : "Something went wrong loading this list."}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCwIcon /> Retry
      </Button>
    </div>
  );
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  query: TableQuery<T>;
  list: ListParamsApi;
  /** Stable identity per row — the primary key, not the array index. */
  rowKey: (row: T) => React.Key;
  onRowClick?: (row: T) => void;
  /** Optional semantic styling for a real data row. */
  rowClassName?: (row: T) => string | undefined;
  /** A trailing, right-aligned column for per-row buttons. */
  rowActions?: (row: T) => React.ReactNode;
  empty?: EmptyState;
  /** Screen-reader description of the table. */
  caption?: string;
  hidePagination?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  query,
  list,
  rowKey,
  onRowClick,
  rowClassName,
  rowActions,
  empty,
  caption,
  hidePagination,
  className,
}: DataTableProps<T>) {
  if (isForbidden(query.error)) return <Forbidden />;

  const { params } = list;
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const span = columns.length + (rowActions ? 1 : 0);

  if (query.error) {
    return <ListError error={query.error} onRetry={query.refetch} className={className} />;
  }

  return (
    <div className={cn("rounded-xl ring-1 ring-foreground/10", className)}>
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const active = column.sortable === true && params.sort === column.key;
              return (
                <TableHead
                  key={column.key}
                  aria-sort={active ? (params.order === "asc" ? "ascending" : "descending") : undefined}
                  className={cn("text-muted-foreground", columnClass(column))}
                >
                  {column.sortable ? (
                    <SortHeader
                      label={column.header}
                      active={active}
                      order={params.order}
                      onClick={() => list.toggleSort(column.key)}
                    />
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
            {rowActions && (
              <TableHead className="w-0 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody
          className={cn(
            "transition-opacity",
            query.isFetching && !query.isPending && "opacity-60",
          )}
        >
          {query.isPending ? (
            Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                {Array.from({ length: span }, (_, cell) => (
                  <TableCell key={cell}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={span} className="py-12 text-center whitespace-normal">
                <p className="font-medium">
                  {empty?.title ??
                    (params.q ? `Nothing matches “${params.q}”` : "Nothing here yet")}
                </p>
                {(empty?.description ?? list.isFiltered) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {empty?.description ?? "Try a different search or clear the filters."}
                  </p>
                )}
                <div className="mt-3 flex justify-center gap-2">
                  {list.isFiltered && (
                    <Button variant="outline" size="sm" onClick={list.reset}>
                      Clear filters
                    </Button>
                  )}
                  {empty?.action}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick && (() => onRowClick(row))}
                onKeyDown={
                  onRowClick &&
                  ((event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onRowClick(row);
                  })
                }
                className={cn(
                  onRowClick &&
                    "cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={columnClass(column)}>
                    {column.cell(row)}
                  </TableCell>
                ))}
                {rowActions && (
                  <TableCell
                    className="text-right"
                    // Row buttons must not also trigger the row's own click.
                    onClick={(event) => event.stopPropagation()}
                  >
                    {rowActions(row)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!hidePagination && meta && meta.total > 0 && <Pagination meta={meta} list={list} />}
    </div>
  );
}
