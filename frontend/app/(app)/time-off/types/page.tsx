import { Suspense } from "react";

import { LeaveTypesList } from "@/app/(app)/time-off/types/leave-types-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaveTypesPage() {
  return (
    <RequirePermission permission="leave-types:write">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <LeaveTypesList />
      </Suspense>
    </RequirePermission>
  );
}
