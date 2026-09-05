import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function TimeOffPage() {
  return (
    <RequirePermission permission="time-off:read">
      <StepPlaceholder
        title="Time Off"
        step="P1-4"
        description="Balances, upcoming leave and pending requests at a glance."
      />
    </RequirePermission>
  );
}
