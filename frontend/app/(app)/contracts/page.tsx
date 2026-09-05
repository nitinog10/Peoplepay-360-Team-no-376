import { Suspense } from "react";

import { ContractsList } from "@/components/contracts/contracts-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContractsPage() {
  return (
    <RequirePermission permission="contracts:read">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <ContractsList />
      </Suspense>
    </RequirePermission>
  );
}
