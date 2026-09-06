import { Suspense } from "react";

import { PayslipsList } from "@/app/(app)/payroll/payslips/payslips-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayslipsPage() {
  return (
    <RequirePermission permission="payslips:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <PayslipsList />
      </Suspense>
    </RequirePermission>
  );
}
