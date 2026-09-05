import { RequirePermission } from "@/components/forbidden";
import { StepPlaceholder } from "@/components/shell/step-placeholder";

export default function ContractsPage() {
  return (
    <RequirePermission permission="contracts:read">
      <StepPlaceholder
        title="Contracts"
        step="P1-5 (own) / P2-3 (HR)"
        description="Employment contracts with the active one highlighted; an employee sees only their own."
      />
    </RequirePermission>
  );
}
