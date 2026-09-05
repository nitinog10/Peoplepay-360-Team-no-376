"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListParamsApi, ParamValue } from "@/hooks/use-list-params";
import { cn } from "@/lib/utils";

/**
 * Module filters, declared as data.
 *
 * Every screen's filters differ but the plumbing does not: read the value out of
 * the URL, write it back, and reset to page 1 — all of which `useListParams`
 * already does. A screen therefore describes its filters and hands them over.
 *
 * Search and free-text filters submit on Enter, on blur, or on the search button
 * rather than on every keystroke: one request per intention instead of one per
 * character, on an API that filters server-side. Those inputs are uncontrolled
 * and re-synced imperatively when the URL changes underneath them (Back button,
 * Clear), which keeps the caret still while typing.
 */

export interface FilterOption {
  /** Never `""` — Radix reserves the empty string, so "any" is the absent key. */
  value: string;
  label: string;
}

export type FilterDef =
  | {
      kind: "select";
      key: string;
      label: string;
      options: readonly FilterOption[];
      /** Wording for the "no filter" entry; defaults to `All`. */
      allLabel?: string;
      className?: string;
    }
  | { kind: "date"; key: string; label: string; className?: string }
  | { kind: "text"; key: string; label: string; placeholder?: string; className?: string };

/** Sentinel for the "no filter" option: Radix rejects `value=""` on an item. */
const ANY = "__any__";

/**
 * An uncontrolled text box that pushes its value on Enter, blur or button.
 *
 * The effect writes to the DOM node, not to React state, so it neither trips
 * `react-hooks/set-state-in-effect` nor remounts the input mid-typing; skipping
 * the write while the box has focus keeps a slow round-trip from eating a
 * half-typed word.
 */
function TextFilter({
  id,
  value,
  placeholder,
  ariaLabel,
  icon,
  className,
  onSubmit,
}: {
  id: string;
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  icon?: boolean;
  className?: string;
  onSubmit: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (!input || input.value === value) return;
    if (document.activeElement === input) return;
    input.value = value;
  }, [value]);

  const submit = () => {
    const next = ref.current?.value.trim() ?? "";
    if (next !== value) onSubmit(next);
  };

  return (
    <div className={cn("relative", className)}>
      {icon && (
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Input
        id={id}
        ref={ref}
        type="search"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(icon && "pl-8", value && "pr-8")}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape" && value) {
            event.currentTarget.value = "";
            onSubmit("");
          }
        }}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            if (ref.current) ref.current.value = "";
            onSubmit("");
          }}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}

function Filter({ def, list }: { def: FilterDef; list: ListParamsApi }) {
  const id = useId();
  const value = list.filters[def.key] ?? "";
  const set = (next: ParamValue) => list.setFilter(def.key, next);

  return (
    <div className={cn("flex flex-col gap-1", def.className)}>
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {def.label}
      </Label>
      {def.kind === "select" ? (
        <Select value={value || ANY} onValueChange={(next) => set(next === ANY ? null : next)}>
          <SelectTrigger id={id} className="w-full min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{def.allLabel ?? "All"}</SelectItem>
            {def.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : def.kind === "date" ? (
        // A native date input emits `YYYY-MM-DD`, which is exactly what the API's
        // `?date=` / `?from=` filters accept — see `dateOnly` in `src/lib/validation.ts`.
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(event) => set(event.target.value || null)}
          className="w-40"
        />
      ) : (
        <TextFilter
          id={id}
          value={value}
          placeholder={def.placeholder}
          onSubmit={(next) => set(next || null)}
        />
      )}
    </div>
  );
}

/**
 * The bar above a `DataTable`: search, the module's own filters, and a Clear.
 *
 * `children` is a trailing slot for anything a single screen needs and no other
 * does — a view toggle, an export button — so those never become props here.
 */
export function FilterBar({
  list,
  filters = [],
  search = true,
  searchPlaceholder = "Search…",
  searchLabel = "Search",
  children,
  className,
}: {
  list: ListParamsApi;
  filters?: readonly FilterDef[];
  /** `false` on a list whose API ignores `?q=`. */
  search?: boolean;
  searchPlaceholder?: string;
  searchLabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const searchId = useId();

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      {search && (
        <div className="flex min-w-52 flex-1 flex-col gap-1 sm:max-w-72">
          <Label htmlFor={searchId} className="text-xs font-normal text-muted-foreground">
            {searchLabel}
          </Label>
          <TextFilter
            id={searchId}
            icon
            value={list.params.q ?? ""}
            placeholder={searchPlaceholder}
            onSubmit={list.setSearch}
          />
        </div>
      )}

      {filters.map((def) => (
        <Filter key={def.key} def={def} list={list} />
      ))}

      {list.isFiltered && (
        <Button variant="ghost" size="sm" onClick={list.reset}>
          <XIcon /> Clear
        </Button>
      )}

      {children && <div className="ml-auto flex items-end gap-2">{children}</div>}
    </div>
  );
}
