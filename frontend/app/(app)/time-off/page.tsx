import { RequirePermission } from "@/components/forbidden";
import { TimeOffDashboard } from "@/components/time-off/dashboard";

export default function TimeOffPage() {
  return (
    <RequirePermission permission="time-off:read">
      <TimeOffDashboard />
    </RequirePermission>
  );
}
