"use client";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { ListError, type EmptyState, type TableQuery } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListParamsApi } from "@/hooks/use-list-params";
import { cn } from "@/lib/utils";

/** A responsive grouped board over the same paginated data used by DataTable. */
export interface KanbanGroup {
  key: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

export interface KanbanProps<T> {
  query: TableQuery<T>;
  groups: readonly KanbanGroup[];
  groupOf: (row: T) => string | number | null | undefined;
  rowKey: (row: T) => React.Key;
  renderCard: (row: T) => React.ReactNode;
  onCardClick?: (row: T) => void;
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
    <section className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border/70 bg-muted/35 p-3">
      <header className="flex items-baseline justify-between gap-2 px-0.5">
        <h3 className="min-w-0 truncate text-sm font-semibold">{label}</h3>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{count}</span>
      </header>
      {description && <p className="px-0.5 text-xs text-muted-foreground">{description}</p>}
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
    return <div className="rounded-xl border border-border/70 bg-card p-3 text-sm shadow-sm">{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border/70 bg-card p-3 text-left text-sm shadow-sm outline-none transition-colors hover:bg-accent/45 focus-visible:ring-3 focus-visible:ring-ring/50"
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
      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
        {Array.from({ length: 3 }, (_, column) => (
          <div key={column} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-muted/40 p-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }, (_, card) => (
              <Skeleton key={card} className="h-16 rounded-xl" />
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
          "flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-12 text-center",
          className,
        )}
      >
        <p className="font-medium">
          {empty?.title ??
            (list?.params.q ? `Nothing matches “${list.params.q}”` : "Nothing here yet")}
        </p>
        {empty?.description && <p className="text-sm text-muted-foreground">{empty.description}</p>}
        {empty?.action}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "grid items-start gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-3",
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
                <p className="rounded-xl border border-dashed px-2.5 py-4 text-center text-xs text-muted-foreground">
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
        <Pagination meta={meta} list={list} className="rounded-2xl border bg-card" />
      )}
    </div>
  );
}
