"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Field, Form, FormActions, FormBanner, FormGrid, SubmitButton, useApiForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ApiError,
  api,
  contractKeys,
  employeeKeys,
  type Contract,
  type ContractBody,
  type ContractType,
  type UpdateContractBody,
} from "@/lib/api";
import { formatDate, todayDateOnly, toDateOnly } from "@/lib/format";

const CONTRACT_TYPES: readonly ContractType[] = ["PERMANENT", "FIXED_TERM", "INTERNSHIP", "CONTRACTOR"];

type ContractConflict = Pick<Contract, "contractId" | "startDate" | "endDate">;

const schema = z.object({
  employeeId: z.string(),
  contractType: z.enum(["PERMANENT", "FIXED_TERM", "INTERNSHIP", "CONTRACTOR"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string(),
  baseSalary: z.string().refine((value) => !value || /^\d+(\.\d{1,2})?$/.test(value), "Use a non-negative amount with at most two decimals"),
  currency: z.string().trim().refine((value) => !value || /^[A-Za-z]{3}$/.test(value), "Use a three-letter currency code"),
  documentUrl: z.string().trim().refine((value) => !value || z.string().url().safeParse(value).success, "Enter a valid URL"),
}).refine((value) => !value.endDate || value.endDate >= value.startDate, {
  path: ["endDate"],
  message: "End date must be on or after start date",
});

type Values = z.infer<typeof schema>;

function defaults(contract?: Contract, employeeId?: number): Values {
  return {
    employeeId: contract ? String(contract.employeeId) : employeeId ? String(employeeId) : "",
    contractType: contract?.contractType ?? "PERMANENT",
    startDate: contract ? toDateOnly(contract.startDate) : todayDateOnly(),
    endDate: contract?.endDate ? toDateOnly(contract.endDate) : "",
    baseSalary: contract?.baseSalary === null || contract?.baseSalary === undefined ? "" : String(contract.baseSalary),
    currency: contract?.currency ?? "",
    documentUrl: contract?.documentUrl ?? "",
  };
}

function body(values: Values): ContractBody {
  return {
    employeeId: Number(values.employeeId),
    contractType: values.contractType,
    startDate: values.startDate,
    endDate: values.endDate || null,
    baseSalary: values.baseSalary ? Number(values.baseSalary) : null,
    ...(values.currency ? { currency: values.currency.toUpperCase() } : {}),
    documentUrl: values.documentUrl || null,
  };
}

function contractPeriod(contract: ContractConflict): string {
  return `${formatDate(contract.startDate)} – ${contract.endDate ? formatDate(contract.endDate) : "Open-ended"}`;
}

function conflictsFrom(details: unknown): ContractConflict[] {
  const conflicts = (details as { conflicts?: unknown } | null)?.conflicts;
  if (!Array.isArray(conflicts)) return [];
  return conflicts.filter((value): value is ContractConflict => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.contractId === "number"
      && Number.isInteger(candidate.contractId)
      && typeof candidate.startDate === "string"
      && (candidate.endDate === null || typeof candidate.endDate === "string");
  });
}

function overlapMessage(error: ApiError): string | undefined {
  if (error.status !== 409 || error.code !== "CONFLICT") return undefined;
  const conflicts = conflictsFrom(error.details);
  if (conflicts.length === 0) return undefined;
  const records = conflicts.map((conflict) => `Contract #${conflict.contractId} (${contractPeriod(conflict)})`).join(", ");
  return `${records} ${conflicts.length === 1 ? "overlaps" : "overlap"} this period. Terminate the existing contract or choose non-overlapping dates.`;
}

export function ContractFormDialog({
  contract,
  defaultEmployeeId,
  trigger,
}: {
  contract?: Contract;
  defaultEmployeeId?: number;
  trigger: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const employees = useQuery({
    ...api.employees.list({ pageSize: 100, sort: "lastName", order: "asc" }),
    enabled: open && !contract,
  });
  const form = useApiForm<Values, Contract>({
    schema,
    defaultValues: defaults(contract, defaultEmployeeId),
    fields: ["employeeId", "contractType", "startDate", "endDate", "baseSalary", "currency", "documentUrl"],
    submit: (values) => contract
      ? api.contracts.update(contract.contractId, { ...body(values), employeeId: undefined } as UpdateContractBody)
      : api.contracts.create(body(values)),
    onApiError: (error, apiForm) => {
      const message = overlapMessage(error);
      if (message) {
        apiForm.setError("startDate", { type: "server", message }, { shouldFocus: true });
        apiForm.setError("endDate", { type: "server", message });
        return message;
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(contractKeys.detail(saved.contractId), saved);
      void queryClient.invalidateQueries({ queryKey: contractKeys.all });
      void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
      setOpen(false);
      toast.success(contract ? "Contract changes saved" : "Contract created");
    },
  });
  const { register } = form.form;
  const selectedEmployeeId = Number(form.form.watch("employeeId"));
  const hasSelectedEmployee = Number.isInteger(selectedEmployeeId) && selectedEmployeeId > 0;
  const activeContracts = useQuery({
    ...api.contracts.list({
      employeeId: hasSelectedEmployee ? selectedEmployeeId : undefined,
      status: "ACTIVE",
      pageSize: 100,
      sort: "startDate",
      order: "desc",
    }),
    enabled: open && !contract && hasSelectedEmployee,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      form.setFormError(null);
      if (next) form.form.reset(defaults(contract, defaultEmployeeId));
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{contract ? `Edit contract #${contract.contractId}` : "New contract"}</DialogTitle>
          <DialogDescription>Contract status and weekly lifecycle changes are managed by the API; use Terminate for an active contract.</DialogDescription>
        </DialogHeader>
        <Form api={form}>
          {!contract && hasSelectedEmployee && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm" aria-live="polite">
              {activeContracts.isPending ? (
                <p className="flex items-center gap-2 text-muted-foreground"><LoaderCircleIcon className="size-4 animate-spin" /> Checking active contracts…</p>
              ) : activeContracts.isError ? (
                <p className="text-destructive">Active contracts could not be checked. Refresh and try again.</p>
              ) : (activeContracts.data?.data.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 font-medium text-warning"><CircleAlertIcon className="size-4" /> Active contracts in the database</p>
                  <ul className="space-y-1.5">
                    {activeContracts.data?.data.map((activeContract) => (
                      <li key={activeContract.contractId} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-background px-3 py-2">
                        <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/contracts/${activeContract.contractId}`} onClick={() => setOpen(false)}>
                          Contract #{activeContract.contractId}
                        </Link>
                        <span className="text-muted-foreground">
                          {contractPeriod(activeContract)} · {activeContract.isCurrent ? "Current" : "Scheduled"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Terminate an existing contract or choose dates that do not overlap before creating a replacement.</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No active contracts found for this employee.</p>
              )}
            </div>
          )}
          <FormGrid>
            {!contract && (
              <Field name="employeeId" label="Employee" required>
                {(control) => (
                  <Select value={form.form.watch("employeeId") || undefined} onValueChange={(value) => form.form.setValue("employeeId", value, { shouldValidate: true })}>
                    <SelectTrigger {...control} className="w-full"><SelectValue placeholder={employees.isPending ? "Loading employees…" : "Select employee"} /></SelectTrigger>
                    <SelectContent>
                      {(employees.data?.data ?? []).filter((employee) => employee.status !== "TERMINATED").map((employee) => (
                        <SelectItem key={employee.employeeId} value={String(employee.employeeId)}>{employee.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
            <Field name="contractType" label="Contract type" required>
              {(control) => (
                <Select value={form.form.watch("contractType")} onValueChange={(value) => form.form.setValue("contractType", value as ContractType, { shouldValidate: true })}>
                  <SelectTrigger {...control} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </Field>
            <Field name="startDate" label="Start date" required>{(control) => <Input {...control} type="date" {...register("startDate")} />}</Field>
            <Field name="endDate" label="End date">{(control) => <Input {...control} type="date" {...register("endDate")} />}</Field>
            <Field name="baseSalary" label="Base salary">{(control) => <Input {...control} inputMode="decimal" placeholder="0.00" {...register("baseSalary")} />}</Field>
            <Field name="currency" label="Currency" description={contract ? undefined : "Leave blank to use the API default."}>{(control) => <Input {...control} maxLength={3} placeholder="USD" {...register("currency")} />}</Field>
            <Field name="documentUrl" label="Document URL" className="sm:col-span-2">{(control) => <Input {...control} type="url" placeholder="https://…" {...register("documentUrl")} />}</Field>
          </FormGrid>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={form.isSubmitting} disabled={!contract && (employees.isPending || !form.form.watch("employeeId"))}>{contract ? "Save changes" : "Create contract"}</SubmitButton>
          </FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function TerminateContractDialog({ contract }: { contract: Contract }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [endDate, setEndDate] = useState(todayDateOnly());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function terminate() {
    setPending(true);
    setError(null);
    try {
      const saved = await api.contracts.terminate(contract.contractId, { endDate });
      queryClient.setQueryData(contractKeys.detail(saved.contractId), saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: contractKeys.all }),
        queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
      ]);
      setOpen(false);
      toast.success("Contract terminated");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "Contract could not be terminated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
      <DialogTrigger asChild><Button type="button" variant="destructive">Terminate</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Terminate contract #{contract.contractId}?</DialogTitle><DialogDescription>The contract will be preserved with TERMINATED status and the selected final date.</DialogDescription></DialogHeader>
        <FormBanner message={error} />
        <div className="flex flex-col gap-1.5"><Label htmlFor={`contract-end-${contract.contractId}`}>End date</Label><Input id={`contract-end-${contract.contractId}`} type="date" min={toDateOnly(contract.startDate)} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={pending || !endDate} onClick={() => void terminate()}>{pending && <LoaderCircleIcon className="animate-spin" />} Terminate contract</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
