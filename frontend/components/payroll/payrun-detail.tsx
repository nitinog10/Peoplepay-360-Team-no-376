"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  BanIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  LoaderCircleIcon,
  MailIcon,
  RefreshCwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { FormBanner } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import {
  api,
  ApiError,
  dashboardKeys,
  payrunKeys,
  payslipKeys,
  type PayrollWarning,
  type PayrunDetail as PayrunDetailResponse,
  type SendPayslipsResult,
} from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatDays } from "@/lib/format";

type LifecycleAction = "compute" | "validate" | "mark-paid";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-xl">{value}</CardTitle></CardHeader>
    </Card>
  );
}

function WarningPanel({
  title,
  description,
  warnings,
  run,
  hard,
}: {
  title: string;
  description: string;
  warnings: PayrollWarning[];
  run: PayrunDetailResponse;
  hard: boolean;
}) {
  const employeeName = (employeeId?: number) => {
    if (!employeeId) return null;
    const slip = run.payslips.find((row) => row.employeeId === employeeId);
    return slip ? `${slip.employee.firstName} ${slip.employee.lastName}` : `Employee #${employeeId}`;
  };

  return (
    <Card className={hard ? "ring-destructive/30" : "ring-warning/40"}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {hard ? <CircleAlertIcon className="size-5 text-destructive" /> : <TriangleAlertIcon className="size-5 text-warning" />}
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline">{warnings.length}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {hard ? "hard" : "soft"} warnings.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.payslipId ?? warning.employeeId ?? index}`} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{warning.code.split("_").join(" ").toLowerCase()}</Badge>
                    {employeeName(warning.employeeId) && <span className="font-medium">{employeeName(warning.employeeId)}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{warning.message}</p>
                </div>
                {warning.payslipId && <Button asChild variant="ghost" size="sm"><Link href={`/payroll/payslips/${warning.payslipId}`}>Open payslip</Link></Button>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SendResultsDialog({ result, onClose }: { result: SendPayslipsResult | null; onClose: () => void }) {
  const sent = result?.results.filter((row) => row.success).length ?? 0;
  return (
    <Dialog open={result !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payslip delivery report</DialogTitle>
          <DialogDescription>
            {result ? `${sent} of ${result.results.length} payslips processed using the ${result.transport.toUpperCase()} transport.` : "Delivery results"}
          </DialogDescription>
        </DialogHeader>
        {result && (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Result</TableHead><TableHead>Message</TableHead></TableRow></TableHeader>
              <TableBody>
                {result.results.map((row) => (
                  <TableRow key={row.payslipId}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell><StatusBadge status={row.success ? "SENT" : "FAILED"} /></TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-muted-foreground">{row.success ? row.messageId ?? "Accepted" : row.error ?? "Delivery failed"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter><Button type="button" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PayrunDetail({ payrunId }: { payrunId: number }) {
  const { can } = useCan();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendPayslipsResult | null>(null);
  const query = useQuery(api.payruns.detail(payrunId));
  const warningsQuery = useQuery(api.payruns.warnings(payrunId));

  const refreshPayroll = (saved?: PayrunDetailResponse) => {
    if (saved) queryClient.setQueryData(payrunKeys.detail(payrunId), saved);
    void queryClient.invalidateQueries({ queryKey: payrunKeys.all });
    void queryClient.invalidateQueries({ queryKey: payslipKeys.all });
  };

  const lifecycle = useMutation({
    mutationFn: async (action: LifecycleAction) => {
      if (action === "compute") return api.payruns.compute(payrunId);
      if (action === "validate") return api.payruns.validate(payrunId);
      return api.payruns.markPaid(payrunId);
    },
    onSuccess: (saved, action) => {
      refreshPayroll(saved);
      toast.success(action === "compute" ? "Payrun computed." : action === "validate" ? "Payrun validated." : "Payrun marked as paid.");
    },
    onError: (error, action) => toast.error(errorMessage(error, `Could not ${action.split("-").join(" ")} the payrun.`)),
  });

  const cancel = useMutation({
    mutationFn: () => api.payruns.cancel(payrunId, cancelReason.trim()),
    onSuccess: (saved) => {
      refreshPayroll(saved);
      setCancelOpen(false);
      setCancelReason("");
      setCancelError(null);
      toast.success("Payrun cancelled.");
    },
    onError: (error) => setCancelError(errorMessage(error, "Could not cancel the payrun.")),
  });

  const send = useMutation({
    mutationFn: () => api.payruns.sendPayslips(payrunId),
    onSuccess: (result) => {
      setSendResult(result);
      const failures = result.results.filter((row) => !row.success).length;
      if (failures > 0) toast.warning(`${failures} payslip${failures === 1 ? "" : "s"} could not be delivered.`);
      else toast.success(`${result.results.length} payslip${result.results.length === 1 ? "" : "s"} sent.`);
    },
    onError: (error) => toast.error(errorMessage(error, "Could not send payslips.")),
  });

  const recompute = useMutation({
    mutationFn: (payslipId: number) => api.payslips.recompute(payslipId),
    onSuccess: (saved) => {
      queryClient.setQueryData(payslipKeys.detail(saved.payslipId), saved);
      refreshPayroll();
      toast.success(`Payslip #${saved.payslipId} recomputed.`);
    },
    onError: (error) => toast.error(errorMessage(error, "Could not recompute the payslip.")),
  });

  const remove = useMutation({
    mutationFn: () => api.payruns.remove(payrunId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: payrunKeys.detail(payrunId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: payrunKeys.all }),
        queryClient.invalidateQueries({ queryKey: payslipKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
      toast.success("Draft payrun deleted.");
      router.push("/payroll/payruns");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not delete the payrun.")),
  });

  if (isForbidden(query.error)) return <Forbidden title="Payroll access denied" description="You do not have access to this payrun." />;
  if (query.isPending) return <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{errorMessage(query.error, "Could not load the payrun.")}</p></div>;

  const run = query.data;
  const canWriteRun = can("payruns:write");
  const canWriteSlip = can("payslips:write");
  const canDeleteRun = can("payruns:delete");
  const mutable = run.status === "DRAFT" || run.status === "COMPUTED";
  const cancellable = run.status === "COMPUTED" || run.status === "VALIDATED";
  const actionPending = lifecycle.isPending || cancel.isPending || send.isPending || recompute.isPending || remove.isPending;
  const canValidate = run.status === "COMPUTED" && warningsQuery.isSuccess && warningsQuery.data.counts.hard === 0;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <Button asChild variant="ghost" className="w-fit"><Link href="/payroll/payruns"><ArrowLeftIcon /> Back to payruns</Link></Button>
      <PageHeader title={run.name} description={`${run.salaryStructure.name} · ${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)}`}>
        <StatusBadge status={run.status} />
        {canWriteRun && mutable && <Button disabled={actionPending} onClick={() => lifecycle.mutate("compute")}>{lifecycle.isPending && lifecycle.variables === "compute" ? <LoaderCircleIcon className="animate-spin" /> : <CalculatorIcon />}Compute</Button>}
        {canWriteRun && run.status === "COMPUTED" && <Button disabled={actionPending || !canValidate} title={!canValidate ? "Resolve hard warnings before validation" : undefined} onClick={() => lifecycle.mutate("validate")}>{lifecycle.isPending && lifecycle.variables === "validate" ? <LoaderCircleIcon className="animate-spin" /> : <CheckCircle2Icon />}Validate</Button>}
        {canWriteRun && run.status === "VALIDATED" && <Button disabled={actionPending} onClick={() => { if (window.confirm("Mark this payrun as paid? This makes the payroll immutable.")) lifecycle.mutate("mark-paid"); }}>{lifecycle.isPending && lifecycle.variables === "mark-paid" ? <LoaderCircleIcon className="animate-spin" /> : <WalletCardsIcon />}Mark paid</Button>}
        {canWriteRun && (run.status === "VALIDATED" || run.status === "PAID") && <Button variant="outline" disabled={actionPending} onClick={() => { if (window.confirm("Send every computed payslip in this payrun? Repeating this action may send duplicate emails.")) send.mutate(); }}>{send.isPending ? <LoaderCircleIcon className="animate-spin" /> : <MailIcon />}Send payslips</Button>}
        {canDeleteRun && run.status === "DRAFT" && <Button variant="destructive" disabled={actionPending} onClick={() => { if (window.confirm("Delete this draft payrun and all of its payslip shells? This cannot be undone.")) remove.mutate(); }}>{remove.isPending ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />}Delete draft</Button>}
        {canWriteRun && cancellable && (
          <Dialog open={cancelOpen} onOpenChange={(open) => { setCancelOpen(open); setCancelError(null); if (!open) setCancelReason(""); }}>
            <DialogTrigger asChild><Button variant="destructive" disabled={actionPending}><BanIcon />Cancel</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cancel this payrun?</DialogTitle><DialogDescription>The run will become read-only and its payslips will no longer block overlapping payroll.</DialogDescription></DialogHeader>
              <FormBanner message={cancelError} />
              <div className="flex flex-col gap-1.5"><Label htmlFor="payrun-cancel-reason">Reason</Label><Textarea id="payrun-cancel-reason" value={cancelReason} maxLength={500} onChange={(event) => setCancelReason(event.target.value)} placeholder="Why is this payrun being cancelled?" /></div>
              <DialogFooter><Button type="button" variant="outline" disabled={cancel.isPending} onClick={() => setCancelOpen(false)}>Keep payrun</Button><Button type="button" variant="destructive" disabled={cancel.isPending || !cancelReason.trim()} onClick={() => cancel.mutate()}>{cancel.isPending && <LoaderCircleIcon className="animate-spin" />}Cancel payrun</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      {run.status === "CANCELLED" && run.cancelReason && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><strong>Cancellation reason:</strong> {run.cancelReason}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Payrun totals">
        <Summary label="Payslips" value={run.payslipCount} />
        <Summary label="Gross" value={formatCurrency(run.totals.gross, run.currency)} />
        <Summary label="Deductions" value={formatCurrency(run.totals.deductions, run.currency)} />
        <Summary label="Net payroll" value={formatCurrency(run.totals.net, run.currency)} />
      </section>

      {warningsQuery.isPending ? <Skeleton className="h-36" /> : warningsQuery.error || !warningsQuery.data ? (
        <p role="alert" className="rounded-xl border p-4 text-sm text-destructive">{errorMessage(warningsQuery.error, "Could not load payroll warnings.")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <WarningPanel title="Hard warnings" description="These issues must be resolved before validation." warnings={warningsQuery.data.hard} run={run} hard />
          <WarningPanel title="Soft warnings" description="Review these issues; they do not block validation." warnings={warningsQuery.data.soft} run={run} hard={false} />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Employee payslips</CardTitle><CardDescription>Calculation inputs and totals captured for this payroll period.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Worked</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net</TableHead><TableHead>Computed</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {run.payslips.map((slip) => (
                <TableRow key={slip.payslipId}>
                  <TableCell><p className="font-medium">{slip.employee.firstName} {slip.employee.lastName}</p><p className="text-xs text-muted-foreground">{slip.employee.department?.departmentName ?? "No department"}</p></TableCell>
                  <TableCell>{formatDays(slip.workedDays)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(slip.gross, slip.currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(slip.deductions, slip.currency)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(slip.net, slip.currency)}</TableCell>
                  <TableCell>{slip.computedAt ? formatDateTime(slip.computedAt) : <span className="text-muted-foreground">Not computed</span>}</TableCell>
                  <TableCell><div className="flex justify-end gap-1"><Button asChild variant="ghost" size="sm"><Link href={`/payroll/payslips/${slip.payslipId}`}>View</Link></Button>{canWriteSlip && mutable && <Button variant="outline" size="sm" disabled={actionPending} onClick={() => recompute.mutate(slip.payslipId)}>{recompute.isPending && recompute.variables === slip.payslipId ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}Recompute</Button>}</div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <SendResultsDialog result={sendResult} onClose={() => setSendResult(null)} />
    </div>
  );
}
