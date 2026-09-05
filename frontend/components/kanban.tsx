"use client";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { ListError, type EmptyState, type TableQuery } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListParamsApi } from "@/hooks/use-list-params";
import { cn } from "@/lib/utils";

/**
 * A grouped-column board over the same `{ data, meta }` page a `DataTable` reads,
 * so a screen can offer both views of one query (P2-1's employees board, columns
 * = department).
 *
 * Columns are declared rather than inferred from the rows: a department with no
 * employees is a real, empty column, and inference would silently drop it. Rows
 * whose group is missing from `groups` collect in a trailing column that appears
 * only when it has cards.
 *
 * Presentational — no drag-and-drop. Moving an employee between departments is an
 * `employees:write` PATCH behind a form, not a drop target, so nothing here
 * pretends otherwise.
 */

export interface KanbanGroup {
  /** Matched against `groupOf(row)`; stringified, so an id works. */
  key: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

export interface KanbanProps<T> {
  query: TableQuery<T>;
  groups: readonly KanbanGroup[];
  /** The column a row belongs in; `null` sends it to the trailing column. */
  groupOf: (row: T) => string | number | null | undefined;
  rowKey: (row: T) => React.Key;
  renderCard: (row: T) => React.ReactNode;
  onCardClick?: (row: T) => void;
  /** Shown under the board; omit to leave paging to the caller. */
  list?: ListParamsApi;
  unassignedLabel?: string;
  empty?: EmptyState;
  className?: string;
}

function Column({
  label,
  description,
  count,
  children,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/40 p-2">
      <header className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="truncate text-sm font-medium">{label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </header>
      {description && <p className="px-1 text-xs text-muted-foreground">{description}</p>}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Card({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (!onClick) {
    return <div className="rounded-lg bg-card p-2.5 text-sm ring-1 ring-foreground/10">{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-card p-2.5 text-left text-sm ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}

export function Kanban<T>({
  query,
  groups,
  groupOf,
  rowKey,
  renderCard,
  onCardClick,
  list,
  unassignedLabel = "Unassigned",
  empty,
  className,
}: KanbanProps<T>) {
  if (isForbidden(query.error)) return <Forbidden />;
  if (query.error) {
    return <ListError error={query.error} onRetry={query.refetch} className={className} />;
  }

  if (query.isPending) {
    return (
      <div className={cn("flex gap-3 overflow-x-auto pb-2", className)}>
        {Array.from({ length: 3 }, (_, column) => (
          <div key={column} className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/40 p-2">
            <Skeleton className="mx-1 h-4 w-24" />
            {Array.from({ length: 3 }, (_, card) => (
              <Skeleton key={card} className="h-16 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const buckets = new Map<string, T[]>(groups.map((group) => [group.key, []]));
  const loose: T[] = [];
  for (const row of rows) {
    const key = groupOf(row);
    const bucket = key === null || key === undefined ? undefined : buckets.get(String(key));
    if (bucket) bucket.push(row);
    else loose.push(row);
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
          className,
        )}
      >
        <p className="font-medium">
          {empty?.title ??
            (list?.params.q ? `Nothing matches “${list.params.q}”` : "Nothing here yet")}
        </p>
        {empty?.description && (
          <p className="text-sm text-muted-foreground">{empty.description}</p>
        )}
        {empty?.action}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "flex gap-3 overflow-x-auto pb-2 transition-opacity",
          query.isFetching && "opacity-60",
        )}
      >
        {groups.map((group) => {
          const bucket = buckets.get(group.key) ?? [];
          return (
            <Column
              key={group.key}
              label={group.label}
              description={group.description}
              count={bucket.length}
            >
              {bucket.length === 0 ? (
                <p className="rounded-lg border border-dashed px-2.5 py-4 text-center text-xs text-muted-foreground">
                  Empty
                </p>
              ) : (
                bucket.map((row) => (
                  <Card key={rowKey(row)} onClick={onCardClick && (() => onCardClick(row))}>
                    {renderCard(row)}
                  </Card>
                ))
              )}
            </Column>
          );
        })}

        {loose.length > 0 && (
          <Column label={unassignedLabel} count={loose.length}>
            {loose.map((row) => (
              <Card key={rowKey(row)} onClick={onCardClick && (() => onCardClick(row))}>
                {renderCard(row)}
              </Card>
            ))}
          </Column>
        )}
      </div>

      {list && meta && meta.total > 0 && (
        <Pagination meta={meta} list={list} className="rounded-xl border-t-0 ring-1 ring-foreground/10" />
      )}
    </div>
  );
}
