import { Suspense } from "react";

import { EmployeesList } from "@/components/employees/employees-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeesPage() {
  return (
    <RequirePermission permission="employees:write">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-content px-4 py-8">
            <Skeleton className="h-72" />
          </div>
        }
      >
        <EmployeesList />
      </Suspense>
    </RequirePermission>
  );
}
