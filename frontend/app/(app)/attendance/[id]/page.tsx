import { notFound } from "next/navigation";

import { AttendanceRecordDetail } from "@/components/attendance/record-detail";
import { RequirePermission } from "@/components/forbidden";

export default async function AttendanceDetailPage(props: PageProps<"/attendance/[id]">) {
  const { id } = await props.params;
  const recordId = Number(id);
  if (!Number.isInteger(recordId) || recordId <= 0) notFound();

  return (
    <RequirePermission permission="attendance:read">
      <AttendanceRecordDetail recordId={recordId} />
    </RequirePermission>
  );
}
