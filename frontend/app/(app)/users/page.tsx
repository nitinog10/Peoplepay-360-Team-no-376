import { Suspense } from "react";

import { UsersList } from "@/app/(app)/users/users-list";
import { RequirePermission } from "@/components/forbidden";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsersPage() {
  return (
    <RequirePermission permission="users:manage">
      <Suspense fallback={<div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-72" /></div>}>
        <UsersList />
      </Suspense>
    </RequirePermission>
  );
}
