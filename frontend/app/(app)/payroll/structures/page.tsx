import { Suspense } from "react";

import { SalaryStructuresList } from "@/app/(app)/payroll/structures/structures-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalaryStructuresPage() {
  return (
    <RequirePermission permission="salary-config:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <SalaryStructuresList editable />
      </Suspense>
    </RequirePermission>
  );
}
