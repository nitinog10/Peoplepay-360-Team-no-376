"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, LoaderCircleIcon, PrinterIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCan } from "@/hooks/use-can";
import { api, ApiError, dashboardKeys, payrunKeys, payslipKeys } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatDays, formatHours } from "@/lib/format";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

function InputMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-heading text-lg font-medium">{value}</p></div>;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Could not load the payslip.";
}

export function PayslipDetail({ payslipId }: { payslipId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const query = useQuery(api.payslips.detail(payslipId));
  const [printing, setPrinting] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.payslips.remove(payslipId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: payslipKeys.detail(payslipId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: payslipKeys.all }),
        queryClient.invalidateQueries({ queryKey: payrunKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
      toast.success("Draft payslip deleted.");
      router.push("/payroll/payslips");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not delete the payslip."),
  });

  async function printPayslip() {
    const preview = window.open("", "_blank");
    if (preview) {
      preview.opener = null;
      preview.document.title = `Payslip #${payslipId}`;
      preview.document.body.innerHTML = "<p style='font-family: sans-serif; padding: 24px'>Preparing payslip…</p>";
    }
    setPrinting(true);
    try {
      const file = await api.payslips.downloadPdf(payslipId);
      const url = URL.createObjectURL(file.blob);
      if (preview) preview.location.replace(url);
      else {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.filename ?? `payslip-${payslipId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      preview?.close();
      toast.error(error instanceof ApiError ? error.message : "Could not prepare the payslip PDF.");
    } finally {
      setPrinting(false);
    }
  }

  if (isForbidden(query.error)) return <Forbidden title="This payslip is not yours" description="You can only open payslips within your payroll scope." />;
  if (query.isPending) return <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8"><Skeleton className="h-24" /><Skeleton className="h-56" /><Skeleton className="h-72" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{errorMessage(query.error)}</p></div>;

  const slip = query.data;
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <Button asChild variant="ghost" className="w-fit"><Link href="/payroll/payslips"><ArrowLeftIcon /> Back to payslips</Link></Button>
      <PageHeader title={`${slip.employee.firstName} ${slip.employee.lastName}`} description={`Payslip #${slip.payslipId} · ${formatDate(slip.periodStart)} – ${formatDate(slip.periodEnd)}`}>
        <StatusBadge status={slip.status} />
        <Button disabled={printing || !slip.computedAt} title={!slip.computedAt ? "Compute this payslip before printing" : undefined} onClick={() => void printPayslip()}><PrinterIcon />{printing ? "Preparing…" : "Print payslip"}</Button>
        {can("payslips:delete") && slip.status === "DRAFT" && <Button variant="destructive" disabled={remove.isPending} onClick={() => { if (window.confirm("Delete this draft payslip? This cannot be undone.")) remove.mutate(); }}>{remove.isPending ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />}Delete draft</Button>}
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Identification</CardTitle></CardHeader>
        <CardContent><dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Employee email" value={slip.employee.email} />
          <Detail label="Job title" value={slip.employee.jobTitle ?? "—"} />
          <Detail label="Department" value={slip.employee.department?.departmentName ?? "—"} />
          <Detail label="Contract" value={<Link className="text-primary hover:underline" href={`/contracts/${slip.contractId}`}>Contract #{slip.contractId}</Link>} />
          <Detail label="Contract wage" value={formatCurrency(slip.contractWage, slip.currency)} />
          <Detail label="Salary structure" value={<Link className="text-primary hover:underline" href={`/payroll/structures/${slip.salaryStructure.salaryStructureId}`}>{slip.salaryStructure.name}</Link>} />
          <Detail label="Payrun" value={<Link className="text-primary hover:underline" href={`/payroll/payruns/${slip.payrunId}`}>{slip.payrun.name}</Link>} />
          <Detail label="Computed" value={slip.computedAt ? formatDateTime(slip.computedAt) : "Not computed"} />
        </dl></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payroll inputs</CardTitle><CardDescription>Attendance and contract values snapshotted when this payslip was computed.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <InputMetric label="Expected days" value={formatDays(slip.expectedDays)} />
          <InputMetric label="Worked days" value={formatDays(slip.workedDays)} />
          <InputMetric label="Unpaid days" value={formatDays(slip.unpaidDays)} />
          <InputMetric label="Expected hours" value={formatHours(slip.expectedHours)} />
          <InputMetric label="Worked hours" value={formatHours(slip.workedHours)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Salary computation</CardTitle><CardDescription>Rule snapshots are retained so historical payslips do not change with later configuration.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead className="w-16">Order</TableHead><TableHead>Rule</TableHead><TableHead>Category</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {slip.lines.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">This payslip has not been computed.</TableCell></TableRow> : slip.lines.map((line) => (
                <TableRow key={line.payslipLineId}><TableCell>{line.sequence}</TableCell><TableCell><p className="font-medium">{line.ruleName}</p><p className="font-mono text-xs text-muted-foreground">{line.ruleCode}</p></TableCell><TableCell><StatusBadge status={line.category} /></TableCell><TableCell><StatusBadge status={line.method} /></TableCell><TableCell className="text-right font-medium">{formatCurrency(line.amount, slip.currency)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Payslip totals">
        <InputMetric label="Basic" value={formatCurrency(slip.totals.basic, slip.currency)} />
        <InputMetric label="Allowances" value={formatCurrency(slip.totals.allowances, slip.currency)} />
        <InputMetric label="Gross" value={formatCurrency(slip.totals.gross, slip.currency)} />
        <InputMetric label="Deductions" value={formatCurrency(slip.totals.deductions, slip.currency)} />
        <InputMetric label="Net pay" value={formatCurrency(slip.totals.net, slip.currency)} />
      </section>
    </div>
  );
}
