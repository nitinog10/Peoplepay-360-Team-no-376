import { EmployeeForm } from "@/components/employees/employee-form";
import { RequirePermission } from "@/components/forbidden";

export default function NewEmployeePage() {
  return (
    <RequirePermission permission="employees:write">
      <EmployeeForm mode="create" />
    </RequirePermission>
  );
}
