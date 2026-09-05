"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { SalaryRuleTable } from "@/components/payroll/salary-rule-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

export function SalaryStructureDetail({ salaryStructureId, editable }: { salaryStructureId: number; editable: boolean }) {
  const query = useQuery(api.salaryStructures.detail(salaryStructureId));
  if (isForbidden(query.error)) return <Forbidden />;
  if (query.isPending) return <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8"><Skeleton className="h-24" /><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Could not load the salary structure."}</p></div>;

  const structure = query.data;
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8" data-editable={editable}>
      <Button asChild variant="ghost" className="w-fit"><Link href="/payroll/structures"><ArrowLeftIcon /> Back to structures</Link></Button>
      <PageHeader title={structure.name} description={structure.description ?? "Salary structure configuration"}><StatusBadge status={structure.isActive ? "ACTIVE" : "INACTIVE"} /></PageHeader>
      <Card>
        <CardHeader><CardTitle>Structure information</CardTitle><CardDescription>Configuration is read-only during Phase 3.</CardDescription></CardHeader>
        <CardContent><dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Currency" value={structure.currency} /><Detail label="Rules" value={structure.ruleCount} /><Detail label="Payruns" value={structure.payrunCount} /><Detail label="Last updated" value={formatDateTime(structure.updatedAt)} /></dl></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Ordered salary rules</CardTitle><CardDescription>Rules execute in sequence and may reference only earlier rule results.</CardDescription></CardHeader>
        <CardContent><SalaryRuleTable rules={structure.rules} currency={structure.currency} editable={editable} /></CardContent>
      </Card>
    </div>
  );
}
