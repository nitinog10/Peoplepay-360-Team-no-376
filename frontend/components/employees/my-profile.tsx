"use client";

import { useQuery } from "@tanstack/react-query";

import { EmployeeDetails } from "@/components/employees/employee-details";
import { Forbidden, isForbidden } from "@/components/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";

export function MyProfile() {
  const employee = useQuery(api.employees.me());
  const summary = useQuery(api.employees.summary("me"));
  const error = employee.error ?? summary.error;

  if (isForbidden(error)) return <Forbidden />;

  if (employee.isPending || summary.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !employee.data || !summary.data) {
    return (
      <div className="mx-auto w-full max-w-content px-4 py-8">
        <Card><CardContent className="py-10 text-center text-sm text-destructive">
          {error instanceof ApiError ? error.message : "Could not load your profile."}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      <EmployeeDetails employee={employee.data} summary={summary.data} readOnly />
    </div>
  );
}
