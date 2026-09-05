import { Suspense } from "react";

import { AttendanceRecordsList } from "@/components/attendance/records-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function AttendancePage() {
  return (
    <RequirePermission permission="attendance:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72 w-full" /></div>}>
        <AttendanceRecordsList />
      </Suspense>
    </RequirePermission>
  );
}
