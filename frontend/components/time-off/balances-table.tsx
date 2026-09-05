"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { HrLeaveBalances } from "@/components/time-off/balance-management";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";

function days(value: number): string { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value); }

function MyLeaveBalances() {
  const [year, setYear] = useState(() => new Date().getFullYear()); const query = useQuery(api.leaveBalances.me(year));
  if (isForbidden(query.error)) return <Forbidden />;
  return <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8"><PageHeader title="My Leave Balances" description="Remaining, pending and available values are calculated by the service and are never editable here."><div className="flex items-center gap-1" aria-label="Balance year"><Button variant="outline" size="icon-sm" aria-label="Previous year" onClick={() => setYear((value) => value - 1)}><ChevronLeftIcon /></Button><span className="min-w-16 text-center text-sm font-medium tabular-nums">{year}</span><Button variant="outline" size="icon-sm" aria-label="Next year" onClick={() => setYear((value) => value + 1)}><ChevronRightIcon /></Button></div></PageHeader>{query.isPending ? <Skeleton className="h-64 w-full" /> : query.error ? <Card><CardContent className="py-10 text-center text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Could not load leave balances."}</CardContent></Card> : <div className="rounded-xl ring-1 ring-foreground/10"><Table><caption className="sr-only">Leave balances for {query.data?.year ?? year}</caption><TableHeader><TableRow><TableHead>Leave type</TableHead><TableHead className="text-right">Allocated</TableHead><TableHead className="text-right">Carried forward</TableHead><TableHead className="text-right">Used</TableHead><TableHead className="text-right">Remaining</TableHead><TableHead className="text-right">Pending</TableHead><TableHead className="text-right">Available</TableHead></TableRow></TableHeader><TableBody>{query.data?.data.length ? query.data.data.map((balance) => <TableRow key={balance.leaveBalanceId}><TableCell className="font-medium">{balance.leaveType.typeName}</TableCell><TableCell className="text-right tabular-nums">{days(balance.allocatedDays)}</TableCell><TableCell className="text-right tabular-nums">{days(balance.carriedForwardDays)}</TableCell><TableCell className="text-right tabular-nums">{days(balance.usedDays)}</TableCell><TableCell className="text-right tabular-nums">{days(balance.remainingDays)}</TableCell><TableCell className="text-right tabular-nums">{days(balance.pendingDays)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{days(balance.availableDays)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No tracked leave balances for {year}.</TableCell></TableRow>}</TableBody></Table></div>}</div>;
}

export function LeaveBalancesTable() { const { can } = useCan(); return can("leave-balances:write") ? <HrLeaveBalances /> : <MyLeaveBalances />; }
