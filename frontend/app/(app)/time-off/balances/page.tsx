import { Suspense } from "react";

import { LeaveBalancesTable } from "@/components/time-off/balances-table";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaveBalancesPage() {
  return (
    <RequirePermission permission="leave-balances:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <LeaveBalancesTable />
      </Suspense>
    </RequirePermission>
  );
}
