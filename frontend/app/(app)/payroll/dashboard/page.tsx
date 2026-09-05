import { Suspense } from "react";

import { RequirePermission } from "@/components/forbidden";
import { PayrollDashboard } from "@/components/payroll/payroll-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayrollDashboardPage() {
  return (
    <RequirePermission permission="payroll:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-96" /></div>}>
        <PayrollDashboard />
      </Suspense>
    </RequirePermission>
  );
}
