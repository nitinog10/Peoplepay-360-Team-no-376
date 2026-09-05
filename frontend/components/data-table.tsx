"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  RotateCwIcon,
} from "lucide-react";
import { useSyncExternalStore } from "react";

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

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "start" | "end" | "center";
  /** Desktop table visibility. Mobile cards intentionally show every field. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

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

const DESKTOP_QUERY = "(min-width: 48rem)";
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable="true"]';

function subscribeToDesktop(onChange: () => void): () => void {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot(): boolean {
  return false;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

function columnClass<T>(column: Column<T>): string {
  return cn(
    column.align && ALIGN[column.align],
    column.hideBelow && HIDE[column.hideBelow],
    column.className,
  );
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
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex min-h-7 items-center gap-1 rounded-lg px-1.5 py-1 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {label}
      <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      <span className="sr-only">
        {active
          ? `Sorted ${order === "asc" ? "ascending" : "descending"}. Activate to reverse.`
          : "Not sorted. Activate to sort ascending."}
      </span>
    </button>
  );
}

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
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center",
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
  rowKey: (row: T) => React.Key;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  rowActions?: (row: T) => React.ReactNode;
  empty?: EmptyState;
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
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );

  if (isForbidden(query.error)) return <Forbidden />;

  const { params } = list;
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const span = columns.length + (rowActions ? 1 : 0);
  const sortable = columns.filter((column) => column.sortable);

  if (query.error) {
    return <ListError error={query.error} onRetry={query.refetch} className={className} />;
  }

  const isEmpty = !query.isPending && rows.length === 0;
  const emptyContent = (
    <div className="px-5 py-12 text-center">
      <p className="font-medium">
        {empty?.title ?? (params.q ? `Nothing matches “${params.q}”` : "Nothing here yet")}
      </p>
      {(empty?.description ?? list.isFiltered) && (
        <p className="mt-1 text-sm text-muted-foreground">
          {empty?.description ?? "Try a different search or clear the filters."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {list.isFiltered && (
          <Button variant="outline" size="sm" onClick={list.reset}>
            Clear filters
          </Button>
        )}
        {empty?.action}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm",
        className,
      )}
    >
      {isEmpty ? (
        emptyContent
      ) : isDesktop ? (
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const active = column.sortable === true && params.sort === column.key;
                return (
                  <TableHead
                    key={column.key}
                    aria-sort={
                      active ? (params.order === "asc" ? "ascending" : "descending") : undefined
                    }
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
            {query.isPending
              ? Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    {Array.from({ length: span }, (_, cell) => (
                      <TableCell key={cell}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={
                      onRowClick
                        ? (event) => {
                            if (isInteractiveTarget(event.target)) return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            onRowClick(row);
                          }
                        : undefined
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
                    {rowActions && <TableCell className="text-right">{rowActions(row)}</TableCell>}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      ) : (
        <div>
          {sortable.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="mr-1 font-medium">Sort by</span>
              {sortable.map((column) => (
                <SortHeader
                  key={column.key}
                  label={column.header}
                  active={params.sort === column.key}
                  order={params.order}
                  onClick={() => list.toggleSort(column.key)}
                />
              ))}
            </div>
          )}

          <div
            role="list"
            aria-label={caption}
            className={cn(
              "divide-y transition-opacity",
              query.isFetching && !query.isPending && "opacity-60",
            )}
          >
            {query.isPending
              ? Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="space-y-3 p-4" role="listitem">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ))
              : rows.map((row) => (
                  <article
                    key={rowKey(row)}
                    role="listitem"
                    className={cn("p-4", rowClassName?.(row))}
                  >
                    <dl className="grid gap-2.5">
                      {columns.map((column, index) => (
                        <div
                          key={column.key}
                          className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3"
                        >
                          <dt className="text-xs leading-5 text-muted-foreground">
                            {column.header}
                          </dt>
                          <dd
                            className={cn(
                              "min-w-0 break-words text-right text-sm leading-5",
                              index === 0 && "font-semibold text-foreground",
                            )}
                          >
                            {column.cell(row)}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    {(onRowClick || rowActions) && (
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                        {onRowClick && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mr-auto"
                            onClick={() => onRowClick(row)}
                          >
                            View details <ChevronRightIcon />
                          </Button>
                        )}
                        {rowActions?.(row)}
                      </div>
                    )}
                  </article>
                ))}
          </div>
        </div>
      )}

      {!hidePagination && meta && meta.total > 0 && <Pagination meta={meta} list={list} />}
    </div>
  );
}
