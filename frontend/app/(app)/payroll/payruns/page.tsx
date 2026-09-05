import { Suspense } from "react";

import { PayrunsList } from "@/app/(app)/payroll/payruns/payruns-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayrunsPage() {
  return (
    <RequirePermission permission="payroll:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <PayrunsList />
      </Suspense>
    </RequirePermission>
  );
}
