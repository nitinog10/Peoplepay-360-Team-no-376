import { notFound } from "next/navigation";

import { EmployeeForm } from "@/components/employees/employee-form";
import { RequirePermission } from "@/components/forbidden";

export default async function EmployeePage(props: PageProps<"/employees/[id]">) {
  const { id } = await props.params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) notFound();

  return (
    <RequirePermission permission="employees:write">
      <EmployeeForm mode="edit" employeeId={employeeId} />
    </RequirePermission>
  );
}
