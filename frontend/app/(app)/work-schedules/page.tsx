import { Suspense } from "react";

import { WorkSchedulesList } from "@/app/(app)/work-schedules/work-schedules-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkSchedulesPage() {
  return (
    <RequirePermission permission="work-schedules:write">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <WorkSchedulesList />
      </Suspense>
    </RequirePermission>
  );
}
