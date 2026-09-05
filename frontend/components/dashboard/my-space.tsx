"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  Clock3Icon,
  FileTextIcon,
  LogInIcon,
  LogOutIcon,
  PauseIcon,
  PlayIcon,
  UserRoundIcon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RequestTimeOffDialog } from "@/components/time-off/request-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  ApiError,
  attendanceKeys,
  type AttendanceSession,
  type Punch,
} from "@/lib/api";
import { formatDate, formatDays, formatHours, formatTime, todayDateOnly } from "@/lib/format";
import { useSession } from "@/lib/auth/session";

function QueryMessage({ pending, error, empty = "No data yet." }: { pending: boolean; error: unknown; empty?: string }) {
  if (pending) return <Skeleton className="h-20 w-full" />;
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error instanceof ApiError ? error.message : "Could not load this section."}
      </p>
    );
  }
  return <p className="text-sm text-muted-foreground">{empty}</p>;
}

function PunchActions({ session }: { session: AttendanceSession }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: Punch) => api.attendance.punch(action),
    onSuccess: (next) => {
      queryClient.setQueryData(attendanceKeys.session, next);
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not record attendance."),
  });
  const act = (action: Punch) => mutation.mutate(action);

  if (session.state === "OUT") {
    return (
      <Button disabled={mutation.isPending} onClick={() => act("clock-in")}>
        <LogInIcon /> Check in
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => act(session.state === "ON_BREAK" ? "break-end" : "break-start")}
      >
        {session.state === "ON_BREAK" ? <PlayIcon /> : <PauseIcon />}
        {session.state === "ON_BREAK" ? "End break" : "Start break"}
      </Button>
      <Button disabled={mutation.isPending} onClick={() => act("clock-out")}>
        <LogOutIcon /> Check out
      </Button>
    </div>
  );
}

export function MySpace() {
  const router = useRouter();
  const { user, can } = useSession();
  const hrLanding = can("employees:write");
  const today = todayDateOnly();
  const from = format(subDays(new Date(), 6), "yyyy-MM-dd");

  useEffect(() => {
    if (hrLanding) router.replace("/employees");
  }, [hrLanding, router]);

  const employee = useQuery({ ...api.employees.me(), enabled: !hrLanding });
  const summary = useQuery({ ...api.employees.summary("me"), enabled: !hrLanding });
  const schedule = useQuery({ ...api.employees.mySchedule(), enabled: !hrLanding });
  const balances = useQuery({ ...api.leaveBalances.me(), enabled: !hrLanding });
  const session = useQuery({ ...api.attendance.session(), enabled: !hrLanding });
  const attendance = useQuery({
    ...api.attendance.list({ from, to: today, pageSize: 7, sort: "attendanceDate", order: "desc" }),
    enabled: !hrLanding,
  });
  const requests = useQuery({
    ...api.timeOff.list({ pageSize: 5, sort: "requestedAt", order: "desc" }),
    enabled: !hrLanding,
  });

  if (hrLanding) {
    return (
      <div className="mx-auto w-full max-w-content px-4 py-8">
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const profile = employee.data;
  const totalAvailable = balances.data?.data.reduce((sum, balance) => sum + balance.availableDays, 0) ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-8">
      <PageHeader
        title={user?.employee.firstName ? `Hello, ${user.employee.firstName}` : "My Space"}
        description="Your workday, leave and employment information in one place."
      >
        <Button asChild variant="outline">
          <Link href="/employees/me"><UserRoundIcon /> My profile</Link>
        </Button>
        <RequestTimeOffDialog />
      </PageHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>{session.data ? formatDate(session.data.date) : "Attendance"}</CardDescription>
          </CardHeader>
          <CardContent>
            {session.data ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={session.data.state} />
                  <span className="text-sm tabular-nums">{formatHours(session.data.derived.workedHours)}</span>
                </div>
                <PunchActions session={session.data} />
              </div>
            ) : (
              <QueryMessage pending={session.isPending} error={session.error} />
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Current assignment</CardDescription>
          </CardHeader>
          <CardContent>
            {schedule.data ? (
              <div className="space-y-1">
                <p className="font-medium">{schedule.data.schedule.scheduleName}</p>
                <p className="text-sm text-muted-foreground">
                  {schedule.data.schedule.startTime}–{schedule.data.schedule.endTime} · {schedule.data.schedule.weeklyHours}h/week
                </p>
              </div>
            ) : (
              <QueryMessage pending={schedule.isPending} error={schedule.error} empty="No schedule assigned." />
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Available leave</CardTitle>
            <CardDescription>Across tracked leave types</CardDescription>
          </CardHeader>
          <CardContent>
            {balances.data ? (
              <div>
                <p className="text-2xl font-semibold tabular-nums">{formatDays(totalAvailable)}</p>
                <Button asChild variant="link" className="h-auto px-0">
                  <Link href="/time-off/balances">View balances <ArrowRightIcon /></Link>
                </Button>
              </div>
            ) : (
              <QueryMessage pending={balances.isPending} error={balances.error} />
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>{profile?.department?.departmentName ?? "My record"}</CardDescription>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="space-y-1">
                <p className="font-medium">{profile.jobTitle ?? "No job title"}</p>
                <div className="flex items-center gap-2"><StatusBadge status={profile.status} /></div>
              </div>
            ) : (
              <QueryMessage pending={employee.isPending} error={employee.error} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Last 7 days</CardTitle>
            <CardDescription>Your recent attendance records.</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="outline"><Link href="/attendance">All attendance</Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {attendance.data ? (
              attendance.data.data.length > 0 ? (
                <ul className="divide-y">
                  {attendance.data.data.map((record) => (
                    <li key={record.attendanceRecordId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <Clock3Icon className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <Link className="font-medium hover:underline" href={`/attendance/${record.attendanceRecordId}`}>
                          {formatDate(record.attendanceDate)}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {record.derived.firstClockIn ? formatTime(record.derived.firstClockIn) : "No check-in"}
                          {record.derived.lastClockOut ? `–${formatTime(record.derived.lastClockOut)}` : ""}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums">{formatHours(record.derived.workedHours)}</span>
                      <StatusBadge status={record.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <QueryMessage pending={false} error={null} empty="No attendance in this period." />
              )
            ) : (
              <QueryMessage pending={attendance.isPending} error={attendance.error} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest time off</CardTitle>
            <CardDescription>Your five most recent requests.</CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="outline"><Link href="/time-off/requests">All requests</Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {requests.data ? (
              requests.data.data.length > 0 ? (
                <ul className="divide-y">
                  {requests.data.data.map((request) => (
                    <li key={request.timeOffRequestId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <CalendarDaysIcon className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <Link className="font-medium hover:underline" href={`/time-off/requests/${request.timeOffRequestId}`}>
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
              ) : (
                <QueryMessage pending={false} error={null} empty="No time-off requests yet." />
              )
            ) : (
              <QueryMessage pending={requests.isPending} error={requests.error} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Button asChild variant="outline" className="h-auto justify-start p-4">
          <Link href="/contracts"><FileTextIcon /> <span><strong className="block">Contracts</strong><span className="text-xs text-muted-foreground">{summary.data?.counts.contracts ?? "—"} records</span></span></Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start p-4">
          <Link href="/attendance"><Clock3Icon /> <span><strong className="block">Attendance</strong><span className="text-xs text-muted-foreground">{summary.data?.counts.attendance ?? "—"} records</span></span></Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start p-4">
          <Link href="/time-off/balances"><WalletCardsIcon /> <span><strong className="block">Leave balances</strong><span className="text-xs text-muted-foreground">{summary.data?.counts.leaveBalances ?? "—"} types</span></span></Link>
        </Button>
      </section>
    </div>
  );
}
