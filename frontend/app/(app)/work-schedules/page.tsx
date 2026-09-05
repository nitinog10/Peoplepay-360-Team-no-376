import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function WorkSchedulesPage() {
  return (
    <RequirePermission permission="work-schedules:write">
      <StepPlaceholder
        title="Working Schedules"
        step="P2-4"
        description="Weekday and hour patterns, with weekly hours derived by the API, plus assignment history."
      />
    </RequirePermission>
  );
}
