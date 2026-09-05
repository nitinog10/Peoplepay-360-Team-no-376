"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { SalaryConfigDeleteDialog } from "@/components/payroll/salary-config-delete-dialog";
import { SalaryRuleTable } from "@/components/payroll/salary-rule-table";
import { SalaryRuleFormDialog } from "@/components/payroll/salary-rule-form-dialog";
import { SalaryStructureFormDialog } from "@/components/payroll/salary-structure-form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/use-can";
import { api, ApiError, salaryRuleKeys, salaryStructureKeys, type SalaryRule, type SalaryStructureDetail as SalaryStructureDetailType } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

export function SalaryStructureDetail({ salaryStructureId, editable }: { salaryStructureId: number; editable: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useCan();
  const mayEdit = editable && can("salary-config:write");
  const query = useQuery(api.salaryStructures.detail(salaryStructureId));
  const reorder = useMutation({
    mutationFn: (rules: SalaryRule[]) => api.salaryStructures.reorderRules(salaryStructureId, { rules: rules.map((rule, index) => ({ salaryRuleId: rule.salaryRuleId, sequence: (index + 1) * 10 })) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(salaryStructureKeys.detail(salaryStructureId), saved);
      void queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all });
      toast.success("Rule order updated.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not reorder rules."),
  });

  if (isForbidden(query.error)) return <Forbidden />;
  if (query.isPending) return <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8"><Skeleton className="h-24" /><Skeleton className="h-48" /><Skeleton className="h-72" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Could not load the salary structure."}</p></div>;

  const structure = query.data;
  async function invalidateConfig(saved?: SalaryStructureDetailType) {
    if (saved) queryClient.setQueryData(salaryStructureKeys.detail(salaryStructureId), saved);
    await Promise.all([queryClient.invalidateQueries({ queryKey: salaryStructureKeys.all }), queryClient.invalidateQueries({ queryKey: salaryRuleKeys.all })]);
  }
  async function removeStructure() {
    await api.salaryStructures.remove(salaryStructureId);
    queryClient.removeQueries({ queryKey: salaryStructureKeys.detail(salaryStructureId) });
    await invalidateConfig();
    toast.success("Salary structure deleted.");
    router.push("/payroll/structures");
  }
  async function deactivateStructure() {
    const saved = await api.salaryStructures.update(salaryStructureId, { isActive: false });
    await invalidateConfig(saved);
    toast.success("Salary structure deactivated.");
  }
  async function removeRule(rule: SalaryRule) {
    await api.salaryRules.remove(rule.salaryRuleId);
    await invalidateConfig();
    toast.success("Salary rule deleted.");
  }
  async function deactivateRule(rule: SalaryRule) {
    await api.salaryRules.update(rule.salaryRuleId, { isActive: false });
    await invalidateConfig();
    toast.success("Salary rule deactivated.");
  }
  function move(rule: SalaryRule, direction: -1 | 1) {
    const index = structure.rules.findIndex((candidate) => candidate.salaryRuleId === rule.salaryRuleId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= structure.rules.length) return;
    const ordered = [...structure.rules];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    reorder.mutate(ordered);
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8" data-editable={mayEdit}>
      <Button asChild variant="ghost" className="w-fit"><Link href="/payroll/structures"><ArrowLeftIcon />Back to structures</Link></Button>
      <PageHeader title={structure.name} description={structure.description ?? "Salary structure configuration"}>
        <StatusBadge status={structure.isActive ? "ACTIVE" : "INACTIVE"} />
        {mayEdit && <SalaryStructureFormDialog structure={structure} trigger={<Button variant="outline"><PencilIcon />Edit structure</Button>} />}
        {mayEdit && <SalaryConfigDeleteDialog label={structure.name} active={structure.isActive} trigger={<Button variant="destructive">Delete structure</Button>} onDelete={removeStructure} onDeactivate={deactivateStructure} />}
      </PageHeader>
      <Card><CardHeader><CardTitle>Structure information</CardTitle><CardDescription>{mayEdit ? "Changes affect future computations only; historic payslip lines remain unchanged." : "You have read-only access to payroll configuration."}</CardDescription></CardHeader><CardContent><dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Currency" value={structure.currency} /><Detail label="Rules" value={structure.ruleCount} /><Detail label="Payruns" value={structure.payrunCount} /><Detail label="Last updated" value={formatDateTime(structure.updatedAt)} /></dl></CardContent></Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Ordered salary rules</CardTitle><CardDescription>Rules execute in sequence and may reference only earlier rule results.</CardDescription></div>{mayEdit && <SalaryRuleFormDialog structureId={salaryStructureId} nextSequence={(structure.rules.at(-1)?.sequence ?? 0) + 10} trigger={<Button><PlusIcon />New rule</Button>} />}</CardHeader>
        <CardContent><SalaryRuleTable rules={structure.rules} currency={structure.currency} editable={mayEdit} renderActions={mayEdit ? (rule) => { const index = structure.rules.findIndex((item) => item.salaryRuleId === rule.salaryRuleId); return <div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" disabled={reorder.isPending || index === 0} title="Move rule up" onClick={() => move(rule, -1)}><ArrowUpIcon /><span className="sr-only">Move up</span></Button><Button variant="ghost" size="icon-sm" disabled={reorder.isPending || index === structure.rules.length - 1} title="Move rule down" onClick={() => move(rule, 1)}><ArrowDownIcon /><span className="sr-only">Move down</span></Button><SalaryRuleFormDialog rule={rule} structureId={salaryStructureId} trigger={<Button variant="ghost" size="icon-sm" title="Edit rule"><PencilIcon /><span className="sr-only">Edit</span></Button>} /><SalaryConfigDeleteDialog label={rule.name} active={rule.isActive} onDelete={() => removeRule(rule)} onDeactivate={() => deactivateRule(rule)} /></div>; } : undefined} /></CardContent>
      </Card>
    </div>
  );
}
