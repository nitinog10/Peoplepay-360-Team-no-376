import { HammerIcon } from "lucide-react";

/**
 * Stands in for a screen the nav already points at but a later step builds. Keeping
 * the routes real is what lets FE-4's permission guards be exercised now — a 404
 * would prove nothing about the 403 path.
 */
export function StepPlaceholder({
  title,
  step,
  description,
}: {
  title: string;
  step: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <HammerIcon className="size-4 shrink-0" />
        <span>
          Not built yet — step <strong className="font-medium text-foreground">{step}</strong> in{" "}
          <code>docs/build-plan.md</code> fills this screen. The route exists so the
          navigation and its permission guard are real today.
        </span>
      </div>
    </div>
  );
}
