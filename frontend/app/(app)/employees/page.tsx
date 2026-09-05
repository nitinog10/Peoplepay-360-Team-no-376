import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function EmployeesPage() {
  return (
    <RequirePermission permission="employees:write">
      <StepPlaceholder
        title="Employees"
        step="P2-1"
        description="The roster, as a kanban grouped by department and as a filterable list."
      />
    </RequirePermission>
  );
}
