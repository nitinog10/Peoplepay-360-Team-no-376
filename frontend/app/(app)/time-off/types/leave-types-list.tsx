"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LeaveTypeFormDialog } from "@/app/(app)/time-off/types/leave-type-form-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { FormBanner } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { ApiError, api, leaveTypeKeys, type LeaveType } from "@/lib/api";
import { formatDays } from "@/lib/format";

const COLUMNS: readonly Column<LeaveType>[] = [
  { key: "typeName", header: "Name", sortable: true, cell: (leaveType) => <span className="font-medium">{leaveType.typeName}</span> },
  { key: "defaultAnnualDays", header: "Default annual days", sortable: true, align: "end", cell: (leaveType) => formatDays(leaveType.defaultAnnualDays) },
  { key: "description", header: "Description", cell: (leaveType) => leaveType.description || "—" },
  { key: "references", header: "References", align: "end", cell: (leaveType) => `${leaveType.balanceCount} balances · ${leaveType.requestCount} requests` },
];

function DeleteLeaveType({ leaveType }: { leaveType: LeaveType }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await api.leaveTypes.remove(leaveType.leaveTypeId);
      await queryClient.invalidateQueries({ queryKey: leaveTypeKeys.all });
      setOpen(false);
      toast.success("Time off type deleted");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Time off type could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" title="Delete time off type"><Trash2Icon /><span className="sr-only">Delete</span></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {leaveType.typeName}?</DialogTitle>
          <DialogDescription>
            This permanently removes the type. Existing balances or requests block deletion; the server will report any references.
          </DialogDescription>
        </DialogHeader>
        <FormBanner message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending && <LoaderCircleIcon className="animate-spin" />} Delete type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveTypesList() {
  const list = useListParams({ sort: "typeName" });
  const query = useQuery({ ...api.leaveTypes.list(list.params), placeholderData: keepPreviousData });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader
        title="Time Off Types"
        description="Manage default annual allowances. A zero-day type is not balance-tracked."
      >
        <LeaveTypeFormDialog trigger={<Button><PlusIcon /> New type</Button>} />
      </PageHeader>
      <FilterBar list={list} search searchPlaceholder="Search time off types…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(leaveType) => leaveType.leaveTypeId}
        caption="Time off types"
        rowActions={(leaveType) => (
          <div className="flex justify-end gap-1">
            <LeaveTypeFormDialog leaveType={leaveType} trigger={<Button type="button" variant="ghost" size="icon-sm" title="Edit time off type"><PencilIcon /><span className="sr-only">Edit</span></Button>} />
            <DeleteLeaveType leaveType={leaveType} />
          </div>
        )}
        empty={{ title: "No time off types", description: "Create a type to define leave allowances and requests." }}
      />
    </div>
  );
}
