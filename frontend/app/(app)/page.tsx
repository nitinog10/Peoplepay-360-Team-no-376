"use client";

/**
 * Placeholder landing screen. P1-1 replaces this with My Space; until then it
 * proves the FE-3 plumbing end to end: the session survived a reload, and a real
 * authenticated request came back.
 */

import { useQuery } from "@tanstack/react-query";
import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/session";

export default function HomePage() {
  const { user, role } = useSession();
  const summary = useQuery(api.employees.summary("me"));

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {user?.employee.firstName ? `Hello, ${user.employee.firstName}` : "Hello"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.employee.jobTitle ?? "—"}
            {user?.employee.department ? ` · ${user.employee.department.departmentName}` : ""}
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {role === "HR_MANAGER" ? "HR manager" : "Employee"}
        </Badge>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>My record</CardTitle>
            <CardDescription>
              Straight from <code>GET /employees/me/summary</code>.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void summary.refetch()}
            disabled={summary.isFetching}
          >
            {summary.isFetching ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {summary.isPending && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

          {summary.isError && (
            <p role="alert" className="text-sm text-destructive">
              {summary.error instanceof ApiError
                ? summary.error.message
                : "Could not load your record."}
            </p>
          )}

          {summary.data && (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Stat label="Employee ID" value={summary.data.employee.employeeId} />
              <Stat label="Status" value={summary.data.employee.status} />
              <Stat
                label="Contracts"
                value={summary.data.counts.contracts}
              />
              <Stat
                label="Attendance records"
                value={summary.data.counts.attendance}
              />
              <Stat
                label="Time-off requests"
                value={`${summary.data.counts.timeOffRequests} (${summary.data.counts.pendingTimeOffRequests} pending)`}
              />
              <Stat
                label="Direct reports"
                value={summary.data.counts.directReports}
              />
              <Stat
                label="Working schedule"
                value={summary.data.currentSchedule?.scheduleName ?? "None assigned"}
              />
              <Stat
                label="Weekly hours"
                value={summary.data.currentSchedule?.weeklyHours ?? "—"}
              />
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
