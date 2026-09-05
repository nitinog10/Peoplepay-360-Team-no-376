"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, type ListParamsApi } from "@/hooks/use-list-params";
import type { Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";

/** The `meta` half of every list response (`listResponse()` in `src/lib/http.ts`). */
export type PageMeta = Paginated<unknown>["meta"];

/**
 * Pager driven by the server's own `meta`, not by a client-side row count.
 *
 * `total` is the unfiltered-by-page count, so "21–40 of 57" is computed rather
 * than guessed, and the buttons disable at the ends instead of asking for a page
 * the API would clamp anyway.
 */
export function Pagination({
  meta,
  list,
  pageSizes = PAGE_SIZES,
  className,
}: {
  meta: PageMeta;
  list: ListParamsApi;
  pageSizes?: readonly number[];
  className?: string;
}) {
  const { page, pageSize, total, totalPages } = meta;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t px-2 py-2 text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <label className="text-muted-foreground" htmlFor="page-size">
          Rows
        </label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => list.setPageSize(Number(value))}
        >
          <SelectTrigger id="page-size" size="sm" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p aria-live="polite" className="text-muted-foreground tabular-nums">
        {total === 0 ? "No rows" : `${first}–${last} of ${total}`}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="First page"
          disabled={atStart}
          onClick={() => list.setPage(1)}
        >
          <ChevronsLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={atStart}
          onClick={() => list.setPage(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="px-1.5 tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={atEnd}
          onClick={() => list.setPage(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Last page"
          disabled={atEnd}
          onClick={() => list.setPage(totalPages)}
        >
          <ChevronsRightIcon />
        </Button>
      </div>
    </nav>
  );
}
