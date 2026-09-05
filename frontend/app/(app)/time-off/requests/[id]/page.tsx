import { notFound } from "next/navigation";

import { RequirePermission } from "@/components/forbidden";
import { TimeOffRequestDetail } from "@/components/time-off/request-detail";

export default async function TimeOffRequestPage(props: PageProps<"/time-off/requests/[id]">) {
  const { id } = await props.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) notFound();

  return (
    <RequirePermission permission="time-off:read">
      <TimeOffRequestDetail requestId={requestId} />
    </RequirePermission>
  );
}
