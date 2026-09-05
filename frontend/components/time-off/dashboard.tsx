"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClockIcon, CalendarPlusIcon, WalletCardsIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RequestTimeOffDialog } from "@/components/time-off/request-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, type TimeOffRequest } from "@/lib/api";
import { formatDate, formatDays, todayDateOnly } from "@/lib/format";

function RequestRows({ rows, empty }: { rows: TimeOffRequest[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((request) => (
        <li key={request.timeOffRequestId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <CalendarClockIcon className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <Link href={`/time-off/requests/${request.timeOffRequestId}`} className="font-medium hover:underline">
              {request.leaveType.typeName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatDate(request.startDate)}–{formatDate(request.endDate)} · {formatDays(request.totalDays)}
            </p>
          </div>
          <StatusBadge status={request.status} />
        </li>
      ))}
    </ul>
  );
}

function ErrorText({ error }: { error: unknown }) {
  return <p role="alert" className="text-sm text-destructive">{error instanceof ApiError ? error.message : "Could not load this section."}</p>;
}

export function TimeOffDashboard() {
  const today = todayDateOnly();
  const balances = useQuery(api.leaveBalances.me());
  const upcoming = useQuery(api.timeOff.list({ status: "APPROVED", from: today, pageSize: 5, sort: "startDate", order: "asc" }));
  const pending = useQuery(api.timeOff.list({ status: "PENDING", pageSize: 5, sort: "requestedAt", order: "desc" }));

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8">
      <PageHeader title="Time Off" description="Your available balances, upcoming leave and pending requests.">
        <RequestTimeOffDialog trigger={<Button><CalendarPlusIcon /> New request</Button>} />
      </PageHeader>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">My balances</h2>
          <Button asChild variant="link"><Link href="/time-off/balances">View all</Link></Button>
        </div>
        {balances.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
        ) : balances.error ? <ErrorText error={balances.error} /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.data?.data.map((balance) => (
              <Card key={balance.leaveBalanceId} size="sm">
                <CardHeader>
                  <CardTitle>{balance.leaveType.typeName}</CardTitle>
                  <CardDescription>{balance.year}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xl font-semibold tabular-nums">{balance.remainingDays}</p><p className="text-xs text-muted-foreground">Remaining</p></div>
                  <div><p className="text-xl font-semibold tabular-nums">{balance.pendingDays}</p><p className="text-xs text-muted-foreground">Pending</p></div>
                  <div><p className="text-xl font-semibold tabular-nums">{balance.availableDays}</p><p className="text-xs text-muted-foreground">Available</p></div>
                </CardContent>
              </Card>
            ))}
            {balances.data?.data.length === 0 && <p className="text-sm text-muted-foreground">No tracked leave balances for this year.</p>}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming leave</CardTitle>
            <CardDescription>Approved requests starting today or later.</CardDescription>
            <CardAction><WalletCardsIcon className="size-5 text-muted-foreground" /></CardAction>
          </CardHeader>
          <CardContent>
            {upcoming.isPending ? <Skeleton className="h-24" /> : upcoming.error ? <ErrorText error={upcoming.error} /> : <RequestRows rows={upcoming.data?.data ?? []} empty="No upcoming approved leave." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending requests</CardTitle>
            <CardDescription>Requests waiting for an HR decision.</CardDescription>
            <CardAction><Button asChild size="sm" variant="outline"><Link href="/time-off/requests?status=PENDING">View requests</Link></Button></CardAction>
          </CardHeader>
          <CardContent>
            {pending.isPending ? <Skeleton className="h-24" /> : pending.error ? <ErrorText error={pending.error} /> : <RequestRows rows={pending.data?.data ?? []} empty="You have no pending requests." />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
