import { Suspense } from "react";

import { RequirePermission } from "@/components/forbidden";
import { TimeOffRequestsList } from "@/components/time-off/requests-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function TimeOffRequestsPage() {
  return (
    <RequirePermission permission="time-off:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <TimeOffRequestsList />
      </Suspense>
    </RequirePermission>
  );
}
