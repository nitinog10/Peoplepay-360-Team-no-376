import { cn } from "@/lib/utils";

/**
 * Every screen's first element: the title, one line of context, and the actions that
 * belong to the page as a whole.
 *
 * Actions arrive as `children` so this stays a server component — a "New employee"
 * dialog brings its own client boundary with it.
 */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
