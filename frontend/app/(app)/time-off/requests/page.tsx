import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function TimeOffRequestsPage() {
  return (
    <RequirePermission permission="time-off:read">
      <StepPlaceholder
        title="Time Off Requests"
        step="P1-4 (own) / P2-6 (decisions)"
        description="Requests with status badges; HR approves, rejects and cancels from the same list."
      />
    </RequirePermission>
  );
}
