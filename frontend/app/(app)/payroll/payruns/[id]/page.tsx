import { notFound } from "next/navigation";

import { RequirePermission } from "@/components/forbidden";
import { PayrunDetail } from "@/components/payroll/payrun-detail";

export default async function PayrunDetailPage(props: PageProps<"/payroll/payruns/[id]">) {
  const { id } = await props.params;
  const payrunId = Number(id);
  if (!Number.isInteger(payrunId) || payrunId <= 0) notFound();

  return (
    <RequirePermission permission="payroll:read">
      <PayrunDetail payrunId={payrunId} />
    </RequirePermission>
  );
}
