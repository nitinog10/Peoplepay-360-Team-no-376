"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, Trash2Icon, UserRoundXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { FormBanner } from "@/components/form";
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
import {
  ApiError,
  api,
  attendanceKeys,
  contractKeys,
  departmentKeys,
  employeeKeys,
  leaveBalanceKeys,
  timeOffKeys,
  type Employee,
} from "@/lib/api";
import { todayDateOnly } from "@/lib/format";

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "The action could not be completed.";
}

export function EmployeeActions({
  employee,
  directReports,
  isSelf,
  onChanged,
}: {
  employee: Employee;
  directReports: number;
  isSelf: boolean;
  onChanged: (employee: Employee) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [terminationDate, setTerminationDate] = useState(todayDateOnly());
  const [pending, setPending] = useState<"terminate" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function terminate() {
    setPending("terminate");
    setError(null);
    try {
      const updated = await api.employees.terminate(employee.employeeId, { terminationDate });
      queryClient.setQueryData(employeeKeys.detail(employee.employeeId), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
        queryClient.invalidateQueries({ queryKey: contractKeys.all }),
      ]);
      onChanged(updated);
      setTerminateOpen(false);
      toast.success(`${employee.fullName} was terminated`);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("delete");
    setError(null);
    try {
      await api.employees.remove(employee.employeeId);
      queryClient.removeQueries({ queryKey: employeeKeys.detail(employee.employeeId) });
      queryClient.removeQueries({ queryKey: employeeKeys.summary(employee.employeeId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
        queryClient.invalidateQueries({ queryKey: departmentKeys.all }),
        queryClient.invalidateQueries({ queryKey: contractKeys.all }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: leaveBalanceKeys.all }),
        queryClient.invalidateQueries({ queryKey: timeOffKeys.all }),
      ]);
      toast.success(`${employee.fullName} was deleted`);
      router.replace("/employees");
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setPending(null);
    }
  }

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You cannot terminate or delete your own record.</span>;
  }

  return (
    <>
      {employee.status !== "TERMINATED" && (
        <Dialog open={terminateOpen} onOpenChange={(open) => { setTerminateOpen(open); setError(null); }}>
          <DialogTrigger asChild><Button type="button" variant="outline"><UserRoundXIcon /> Terminate</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Terminate {employee.fullName}?</DialogTitle>
              <DialogDescription>
                This closes active contracts and open schedule assignments, deactivates the linked login, and preserves the employee history.
              </DialogDescription>
            </DialogHeader>
            <FormBanner message={error} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="termination-date">Termination date</Label>
              <Input id="termination-date" type="date" value={terminationDate} min={employee.hireDate.slice(0, 10)} onChange={(event) => setTerminationDate(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending !== null} onClick={() => setTerminateOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" disabled={pending !== null || !terminationDate} onClick={() => void terminate()}>
                {pending === "terminate" && <LoaderCircleIcon className="animate-spin" />} Terminate employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); setError(null); }}>
        <DialogTrigger asChild><Button type="button" variant="destructive" disabled={directReports > 0}><Trash2Icon /> Delete</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {employee.fullName} permanently?</DialogTitle>
            <DialogDescription>
              This hard delete removes the linked login, contracts, assignments, attendance, balances, requests, and approvals. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {directReports > 0 && <FormBanner message={`Reassign ${directReports} direct report${directReports === 1 ? "" : "s"} before deleting this employee.`} />}
          <FormBanner message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending !== null} onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={pending !== null || directReports > 0} onClick={() => void remove()}>
              {pending === "delete" && <LoaderCircleIcon className="animate-spin" />} Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
