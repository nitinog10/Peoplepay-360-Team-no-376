import Link from "next/link";

import { cn } from "@/lib/utils";

/** Shared product mark for authenticated and public chrome. */
export function Brand({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href="/"
      aria-label="PeoplePay 360 home"
      onClick={onNavigate}
      className={cn(
        "group inline-flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">
        PP
        <span
          aria-hidden
          className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-background bg-[#14D3BB]"
        />
      </span>
      <span className="min-w-0 font-display text-[1.35rem] leading-none font-semibold text-foreground">
        PeoplePay <span className="text-primary">360</span>
      </span>
    </Link>
  );
}
