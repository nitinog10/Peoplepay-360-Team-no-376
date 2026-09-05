import { StatusBadge, statusLabel } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SalaryRule } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export function RuleCalculation({ rule, currency }: { rule: SalaryRule; currency: string }) {
  if (rule.method === "FIXED") return <>{formatCurrency(rule.fixedAmount, currency)}</>;
  if (rule.method === "PERCENTAGE") {
    const percentage = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(rule.percentage ?? 0);
    return <>{percentage}% of {rule.percentageBase ? statusLabel(rule.percentageBase) : "—"}</>;
  }
  return <code className="whitespace-normal break-all text-xs">{rule.formula ?? "—"}</code>;
}

export function SalaryRuleTable({
  rules,
  currency,
  editable,
  renderActions,
}: {
  rules: SalaryRule[];
  currency: string;
  editable: boolean;
  renderActions?: (rule: SalaryRule) => React.ReactNode;
}) {
  const showActions = editable && renderActions !== undefined;
  return (
    <Table>
      <TableHeader><TableRow><TableHead className="w-16">Order</TableHead><TableHead>Rule</TableHead><TableHead>Category</TableHead><TableHead>Method</TableHead><TableHead>Calculation</TableHead><TableHead>Status</TableHead>{showActions && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
      <TableBody>
        {rules.length === 0 ? <TableRow><TableCell colSpan={showActions ? 7 : 6} className="py-10 text-center text-muted-foreground">This structure has no rules.</TableCell></TableRow> : rules.map((rule) => (
          <TableRow key={rule.salaryRuleId}><TableCell>{rule.sequence}</TableCell><TableCell><p className="font-medium">{rule.name}</p><p className="font-mono text-xs text-muted-foreground">{rule.code}</p></TableCell><TableCell><StatusBadge status={rule.category} /></TableCell><TableCell><StatusBadge status={rule.method} /></TableCell><TableCell><RuleCalculation rule={rule} currency={currency} /></TableCell><TableCell><StatusBadge status={rule.isActive ? "ACTIVE" : "INACTIVE"} /></TableCell>{showActions && <TableCell className="text-right">{renderActions(rule)}</TableCell>}</TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
