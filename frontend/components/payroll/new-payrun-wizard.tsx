"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FormBanner } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, api, payrunKeys, type ContractType, type EligibilityQuery } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

const CONTRACT_TYPES: ContractType[] = ["PERMANENT", "FIXED_TERM", "INTERNSHIP", "CONTRACTOR"];
const ALL_TYPES = "__all__";

function monthPeriod(month: string) {
  const [year, value] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function initialValues() {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { month, ...monthPeriod(month), name: `Payroll ${month}`, structureId: "", contractType: ALL_TYPES };
}

type Values = ReturnType<typeof initialValues>;

export function NewPayrunWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Values>(initialValues);
  const [scope, setScope] = useState<EligibilityQuery | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const structures = useQuery(api.salaryStructures.list({ active: true, pageSize: 100, sort: "name" }));
  const eligibility = useQuery({
    ...api.payruns.eligibility(scope ?? { structureId: 1, from: "2000-01-01", to: "2000-01-01" }),
    enabled: scope !== null && open,
  });
  const selectableIds = useMemo(
    () => eligibility.data?.data.filter((employee) => employee.selectable).map((employee) => employee.employeeId) ?? [],
    [eligibility.data],
  );

  const create = useMutation({
    mutationFn: () =>
      api.payruns.create({
        name: values.name.trim(),
        structureId: Number(values.structureId),
        periodStart: values.from,
        periodEnd: values.to,
        employeeIds: [...selected],
      }),
    onSuccess: async (payrun) => {
      await queryClient.invalidateQueries({ queryKey: payrunKeys.all });
      setOpen(false);
      router.push(`/payroll/payruns/${payrun.payrunId}`);
    },
  });

  function reset() {
    setStep(1);
    setValues(initialValues());
    setScope(null);
    setSelected(new Set());
    create.reset();
  }

  function continueToEmployees() {
    const structureId = Number(values.structureId);
    if (!structureId || !values.name.trim() || !values.from || !values.to || values.to < values.from) return;
    const next: EligibilityQuery = {
      structureId,
      from: values.from,
      to: values.to,
      ...(values.contractType !== ALL_TYPES ? { contractType: values.contractType as ContractType } : {}),
    };
    setScope(next);
    setSelected(new Set());
    setStep(2);
  }

  const error = create.error instanceof ApiError ? create.error.message : create.error ? "The payrun could not be created." : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button><PlusIcon /> New payrun</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New payrun · Step {step} of 2</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Choose the salary scope. Continue only checks eligibility; it does not create a record." : "Select exactly who belongs in this run. Flagged employees cannot be selected."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="payrun-name">Run name</Label>
              <Input id="payrun-name" value={values.name} maxLength={150} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div>
              <Label>Salary structure</Label>
              <Select value={values.structureId} onValueChange={(structureId) => setValues((current) => ({ ...current, structureId }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a structure" /></SelectTrigger>
                <SelectContent>
                  {(structures.data?.data ?? []).map((structure) => <SelectItem key={structure.salaryStructureId} value={String(structure.salaryStructureId)}>{structure.name} · {structure.currency}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payrun-month">Month shortcut</Label>
              <Input id="payrun-month" type="month" value={values.month} onChange={(event) => {
                const month = event.target.value;
                if (!month) return;
                setValues((current) => ({ ...current, month, ...monthPeriod(month) }));
              }} />
            </div>
            <div>
              <Label htmlFor="payrun-from">Period from</Label>
              <Input id="payrun-from" type="date" value={values.from} onChange={(event) => setValues((current) => ({ ...current, from: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="payrun-to">Period to</Label>
              <Input id="payrun-to" type="date" value={values.to} min={values.from} onChange={(event) => setValues((current) => ({ ...current, to: event.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Employee type</Label>
              <Select value={values.contractType} onValueChange={(contractType) => setValues((current) => ({ ...current, contractType }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All contract types</SelectItem>
                  {CONTRACT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.split("_").join(" ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto py-1">
            {eligibility.isPending ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><LoaderCircleIcon className="animate-spin" /> Checking eligibility…</div>
            ) : eligibility.error ? (
              <FormBanner message={eligibility.error instanceof ApiError ? eligibility.error.message : "Eligibility could not be loaded."} />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <span>{selected.size} of {selectableIds.length} selectable employees chosen</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelected(selected.size === selectableIds.length ? new Set() : new Set(selectableIds))}>
                    {selected.size === selectableIds.length ? "Clear" : "Select all"}
                  </Button>
                </div>
                {(eligibility.data?.data ?? []).map((employee) => (
                  <label key={employee.employeeId} className="flex items-start gap-3 rounded-lg border p-3 has-disabled:opacity-60">
                    <Checkbox
                      checked={selected.has(employee.employeeId)}
                      disabled={!employee.selectable}
                      onCheckedChange={(checked) => setSelected((current) => {
                        const next = new Set(current);
                        if (checked === true) next.add(employee.employeeId); else next.delete(employee.employeeId);
                        return next;
                      })}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {employee.firstName} {employee.lastName}
                        {employee.contract && <Badge variant="outline">{employee.contract.contractType.split("_").join(" ")}</Badge>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {employee.jobTitle ?? "No job title"} · {employee.contract ? formatCurrency(employee.contract.baseSalary, employee.contract.currency) : "No active contract"}
                      </span>
                      {employee.flags.map((flag) => <span key={flag.code} className="mt-1 block text-xs text-destructive">{flag.message}</span>)}
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}

        <FormBanner message={error} />
        <DialogFooter>
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" disabled={!values.name.trim() || !values.structureId || !values.from || !values.to || values.to < values.from} onClick={continueToEmployees}>Continue</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={create.isPending} onClick={() => setStep(1)}>Back</Button>
              <Button type="button" disabled={create.isPending || selected.size === 0 || eligibility.isPending} onClick={() => create.mutate()}>
                {create.isPending && <LoaderCircleIcon className="animate-spin" />} Create payrun
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
