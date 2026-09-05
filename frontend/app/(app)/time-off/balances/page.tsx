import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function LeaveBalancesPage() {
  return (
    <RequirePermission permission="leave-balances:read">
      <StepPlaceholder
        title="Allocations"
        step="P1-5 (own) / P2-7 (HR)"
        description="Leave allocations per type and year; remaining and available are API-derived, never inputs."
      />
    </RequirePermission>
  );
}
