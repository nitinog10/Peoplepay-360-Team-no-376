import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
};

/**
 * One tone table for every enum the API returns, keyed by the raw value.
 *
 * Flat rather than per-module because the collisions agree: `ACTIVE` and `TERMINATED`
 * mean the same thing on an employee and on a contract. An unlisted value is drawn
 * neutral instead of throwing, so a new enum member ships as grey and not as a crash.
 */
const TONE: Record<string, Tone> = {
  // employees, contracts
  ACTIVE: "success",
  INACTIVE: "neutral",
  TERMINATED: "danger",
  EXPIRED: "neutral",
  PERMANENT: "info",
  FIXED_TERM: "info",
  INTERNSHIP: "info",
  CONTRACTOR: "info",
  // attendance
  PRESENT: "success",
  ABSENT: "danger",
  HALF_DAY: "warning",
  ON_LEAVE: "info",
  HOLIDAY: "info",
  WEEK_OFF: "neutral",
  // punch state
  IN: "success",
  ON_BREAK: "warning",
  OUT: "neutral",
  // time off
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

/** `HALF_DAY` → "Half day". The API's enums are SCREAMING_SNAKE; screens are not. */
export function statusLabel(value: string): string {
  const words = value.split("_").join(" ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn(TONE_CLASS[TONE[status] ?? "neutral"], className)}>
      {statusLabel(status)}
    </Badge>
  );
}
