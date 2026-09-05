import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { ListsScratch } from "./lists-scratch";

/**
 * FE-6's gate page: `/employees` through the shared primitives, with search,
 * sort, paging and filters living in the URL, plus a department form that shows
 * what the server says about a duplicate name.
 *
 * A server shell around a client child, purely for the `<Suspense>` boundary:
 * `useListParams` reads `useSearchParams()`, which opts its component into
 * request-time rendering, and Next wants that behind a boundary rather than
 * dragging the whole route out of the prerender. Every real list screen in P1/P2
 * follows this shape.
 */
export default function ScratchListsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <ListsScratch />
    </Suspense>
  );
}
