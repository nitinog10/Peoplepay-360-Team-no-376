import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function LeaveTypesPage() {
  return (
    <RequirePermission permission="leave-types:write">
      <StepPlaceholder
        title="Time Off Types"
        step="P2-8"
        description="Leave types and their default annual days; zero days means the type isn't balance-tracked."
      />
    </RequirePermission>
  );
}
