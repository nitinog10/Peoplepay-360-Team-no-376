import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function DepartmentsPage() {
  return (
    // `departments:read` is granted to every role, so the API would happily answer
    // here — the `:write` gate is what makes this screen HR's.
    <RequirePermission permission="departments:write">
      <StepPlaceholder
        title="Departments"
        step="P2-9"
        description="Create, rename and delete departments."
      />
    </RequirePermission>
  );
}
