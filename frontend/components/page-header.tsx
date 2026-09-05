import { cn } from "@/lib/utils";

/** Every screen's title, context and page-level actions. */
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
    <div className={cn("flex flex-wrap items-start justify-between gap-4 sm:items-end", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="sketch-underline break-words font-display text-4xl leading-none font-semibold tracking-normal">
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
