"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogInIcon, LogOutIcon, PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, attendanceKeys, type AttendanceSession, type Punch } from "@/lib/api";
import { formatDate, formatHours, formatMinutes, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/hooks/use-can";

/**
 * Re-render every 10 seconds while `active`, so the elapsed timer rolls over within ten
 * seconds of the true minute. The `setState` sits in the interval callback rather than
 * the effect body, which is what `react-hooks/set-state-in-effect` asks for.
 */
function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}

/**
 * The header punch widget: today's state from `GET /attendance/session`, and the punch
 * the state machine allows next.
 *
 * The buttons come from `state`, not from the response's `allowedActions`, so the pair
 * on screen always matches what the employee can sensibly do — with one deliberate
 * exception: Check Out stays live during a break, because the API answers that with
 * "End your break before clocking out", which is more use than a disabled button. Every
 * refusal is a 422 whose message is the server's own wording, shown unedited.
 */
export function AttendanceWidget() {
  const { can } = useCan();
  const allowed = can("attendance:punch");
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt, isPending, isError, refetch } = useQuery({
    ...api.attendance.session(),
    enabled: allowed,
  });

  const state = data?.state ?? "OUT";
  const open = state !== "OUT";
  const onBreak = state === "ON_BREAK";

  // `elapsedMinutes` already subtracts the open break, so on a break the API's number
  // stands still — and so must ours. Ticking only while working keeps them in step.
  const now = useTicker(open && !onBreak);
  const elapsed = data
    ? data.derived.elapsedMinutes +
      (open && !onBreak ? Math.max(0, Math.floor((now - dataUpdatedAt) / 60_000)) : 0)
    : 0;

  const punch = useMutation({
    mutationFn: (action: Punch) => api.attendance.punch(action),
    onSuccess: (session) => {
      // A punch answers with the session shape, so the widget is right before the
      // refetch lands; the invalidate is what refreshes the records lists behind it.
      queryClient.setQueryData<AttendanceSession>(attendanceKeys.session, session);
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not record the punch.");
    },
  });

  const act = (action: Punch) => punch.mutate(action);
  const busy = punch.isPending;
  const refusal = punch.error
    ? punch.error instanceof ApiError
      ? punch.error.message
      : "Could not record the punch."
    : null;

  if (!allowed) return null;
  if (isPending) return <Skeleton className="h-8 w-36" />;

  if (isError || !data) {
    return (
      <Button variant="outline" size="sm" onClick={() => void refetch()}>
        <RotateCwIcon /> Retry
      </Button>
    );
  }

  const { derived } = data;

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 font-normal">
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                open ? "bg-emerald-500" : "bg-muted-foreground/40",
                open && !onBreak && "animate-pulse",
              )}
            />
            <span className="hidden tabular-nums sm:inline">
              {open ? formatMinutes(elapsed) : "Not checked in"}
            </span>
            {onBreak && (
              <span className="hidden text-amber-600 sm:inline dark:text-amber-500">on break</span>
            )}
            <span className="sr-only">Today&rsquo;s attendance</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <PopoverHeader>
            <PopoverTitle>
              {onBreak ? "On break" : open ? "Checked in" : "Not checked in"}
            </PopoverTitle>
            <PopoverDescription>
              {formatDate(data.date)}
              {derived.scheduleName ? ` · ${derived.scheduleName}` : ""}
            </PopoverDescription>
          </PopoverHeader>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Row label="Worked" value={formatHours(derived.workedHours)} />
            <Row label="Break" value={formatHours(derived.breakHours)} />
            {derived.expectedHours !== null && (
              <Row label="Expected" value={formatHours(derived.expectedHours)} />
            )}
            {derived.overtimeHours > 0 && (
              <Row label="Overtime" value={formatHours(derived.overtimeHours)} />
            )}
            {derived.firstClockIn && (
              <Row label="First in" value={formatTime(derived.firstClockIn)} />
            )}
            {derived.lastClockOut && (
              <Row label="Last out" value={formatTime(derived.lastClockOut)} />
            )}
          </dl>
          {derived.isLate && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Late by {formatMinutes(derived.lateByMinutes)}.
            </p>
          )}
          {derived.sequenceError && (
            <p className="text-xs text-destructive">{derived.sequenceError}</p>
          )}
          {refusal && (
            <p role="alert" className="text-xs text-destructive">
              {refusal}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Worked and break hours count closed periods only, so they catch up when you check
            out.
          </p>
        </PopoverContent>
      </Popover>

      {open ? (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={onBreak ? "End break" : "Start break"}
            onClick={() => act(onBreak ? "break-end" : "break-start")}
          >
            {onBreak ? <PlayIcon /> : <PauseIcon />}
            <span className="hidden sm:inline">{onBreak ? "End break" : "Break"}</span>
          </Button>
          <Button
            size="sm"
            disabled={busy}
            aria-label="Check out"
            onClick={() => act("clock-out")}
          >
            <LogOutIcon /> <span className="hidden min-[480px]:inline">Check Out</span>
          </Button>
        </>
      ) : (
        <Button size="sm" disabled={busy} aria-label="Check in" onClick={() => act("clock-in")}>
          <LogInIcon /> <span className="hidden min-[480px]:inline">Check In</span>
        </Button>
      )}
    </div>
  );
}
