"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScheduleFormDialog } from "@/app/(app)/work-schedules/schedule-form-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { FormBanner } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { ApiError, api, workScheduleKeys, type WorkSchedule } from "@/lib/api";

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const COLUMNS: readonly Column<WorkSchedule>[] = [
  { key: "scheduleName", header: "Schedule", sortable: true, cell: (schedule) => <span className="font-medium">{schedule.scheduleName}</span> },
  { key: "days", header: "Days", cell: (schedule) => schedule.daysOfWeek.map((day) => DAY_LABELS[day]).join(", ") },
  { key: "hours", header: "Hours", cell: (schedule) => `${schedule.startTime}–${schedule.endTime}` },
  { key: "weeklyHours", header: "Weekly", sortable: true, align: "end", cell: (schedule) => `${schedule.weeklyHours}h` },
  { key: "assignments", header: "Assignments", align: "end", cell: (schedule) => schedule.assignmentCount ?? 0 },
];

function DeleteSchedule({ schedule }: { schedule: WorkSchedule }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assigned = (schedule.assignmentCount ?? 0) > 0;

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await api.workSchedules.remove(schedule.scheduleId);
      await queryClient.invalidateQueries({ queryKey: workScheduleKeys.all });
      setOpen(false);
      toast.success("Working schedule deleted");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Working schedule could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
      <DialogTrigger asChild><Button type="button" variant="ghost" size="icon-sm" title={assigned ? "Assigned schedules cannot be deleted" : "Delete schedule"} disabled={assigned}><Trash2Icon /><span className="sr-only">Delete</span></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete {schedule.scheduleName}?</DialogTitle><DialogDescription>This permanently removes the schedule. Historical or current assignments block deletion.</DialogDescription></DialogHeader>
        <FormBanner message={error} />
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>{pending && <LoaderCircleIcon className="animate-spin" />} Delete schedule</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkSchedulesList() {
  const list = useListParams({ sort: "scheduleName" });
  const query = useQuery({ ...api.workSchedules.list(list.params), placeholderData: keepPreviousData });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader title="Working Schedules" description="Manage weekday and hour patterns. Weekly hours are derived by the API.">
        <ScheduleFormDialog trigger={<Button><PlusIcon /> New schedule</Button>} />
      </PageHeader>
      <FilterBar list={list} search searchPlaceholder="Search schedules…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(schedule) => schedule.scheduleId}
        caption="Working schedules"
        rowActions={(schedule) => (
          <div className="flex justify-end gap-1">
            <ScheduleFormDialog schedule={schedule} trigger={<Button type="button" variant="ghost" size="icon-sm"><PencilIcon /><span className="sr-only">Edit</span></Button>} />
            <DeleteSchedule schedule={schedule} />
          </div>
        )}
        empty={{ title: "No working schedules", description: "Create a schedule to assign working hours." }}
      />
    </div>
  );
}
