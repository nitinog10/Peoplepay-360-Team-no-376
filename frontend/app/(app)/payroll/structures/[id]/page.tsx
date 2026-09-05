import { notFound } from "next/navigation";

import { RequirePermission } from "@/components/forbidden";
import { SalaryStructureDetail } from "@/components/payroll/salary-structure-detail";

export default async function SalaryStructureDetailPage(props: PageProps<"/payroll/structures/[id]">) {
  const { id } = await props.params;
  const salaryStructureId = Number(id);
  if (!Number.isInteger(salaryStructureId) || salaryStructureId <= 0) notFound();

  return (
    <RequirePermission permission="salary-config:read">
      <SalaryStructureDetail salaryStructureId={salaryStructureId} editable={false} />
    </RequirePermission>
  );
}
