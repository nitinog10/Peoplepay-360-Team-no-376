import { notFound } from "next/navigation";

import { RequirePermission } from "@/components/forbidden";
import { PayslipDetail } from "@/components/payroll/payslip-detail";

export default async function PayslipDetailPage(props: PageProps<"/payroll/payslips/[id]">) {
  const { id } = await props.params;
  const payslipId = Number(id);
  if (!Number.isInteger(payslipId) || payslipId <= 0) notFound();

  return (
    <RequirePermission permission="payroll:read">
      <PayslipDetail payslipId={payslipId} />
    </RequirePermission>
  );
}
