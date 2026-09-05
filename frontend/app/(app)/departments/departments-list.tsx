"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DepartmentFormDialog } from "@/app/(app)/departments/department-form-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { FormBanner } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { ApiError, api, departmentKeys, type Department } from "@/lib/api";

const COLUMNS: readonly Column<Department>[] = [
  { key: "departmentName", header: "Department", sortable: true, cell: (department) => <span className="font-medium">{department.departmentName}</span> },
  { key: "description", header: "Description", cell: (department) => department.description || "—" },
  { key: "employees", header: "Employees", align: "end", cell: (department) => department.employeeCount },
];

function DeleteDepartment({ department }: { department: Department }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await api.departments.remove(department.departmentId);
      queryClient.removeQueries({ queryKey: departmentKeys.detail(department.departmentId) });
      await queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      setOpen(false);
      toast.success("Department deleted");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Department could not be deleted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" title="Delete department"><Trash2Icon /><span className="sr-only">Delete</span></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {department.departmentName}?</DialogTitle>
          <DialogDescription>
            This permanently removes the department. Its {department.employeeCount} employee(s) must be reassigned before deletion.
          </DialogDescription>
        </DialogHeader>
        <FormBanner message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending && <LoaderCircleIcon className="animate-spin" />} Delete department
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DepartmentsList() {
  const list = useListParams({ sort: "departmentName" });
  const query = useQuery({ ...api.departments.list(list.params), placeholderData: keepPreviousData });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader title="Departments" description="Create, rename, and organize departments and their employee assignments.">
        <DepartmentFormDialog trigger={<Button><PlusIcon /> New department</Button>} />
      </PageHeader>
      <FilterBar list={list} search searchPlaceholder="Search department names…" />
      <DataTable
        columns={COLUMNS}
        query={query}
        list={list}
        rowKey={(department) => department.departmentId}
        caption="Departments"
        rowActions={(department) => (
          <div className="flex justify-end gap-1">
            <DepartmentFormDialog department={department} trigger={<Button type="button" variant="ghost" size="icon-sm" title="Edit department"><PencilIcon /><span className="sr-only">Edit</span></Button>} />
            <DeleteDepartment department={department} />
          </div>
        )}
        empty={{ title: "No departments", description: "Create a department to organize employees." }}
      />
    </div>
  );
}
