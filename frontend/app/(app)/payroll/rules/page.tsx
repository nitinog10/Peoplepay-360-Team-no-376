import { Suspense } from "react";

import { SalaryRulesList } from "@/app/(app)/payroll/rules/rules-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalaryRulesPage() {
  return (
    <RequirePermission permission="salary-config:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <SalaryRulesList editable={false} />
      </Suspense>
    </RequirePermission>
  );
}
