import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function AttendancePage() {
  return (
    <RequirePermission permission="attendance:read">
      <StepPlaceholder
        title="Attendance"
        step="P1-3 (own) / P2-5 (HR)"
        description="Daily records with worked, break and overtime hours derived from the punches."
      />
    </RequirePermission>
  );
}
