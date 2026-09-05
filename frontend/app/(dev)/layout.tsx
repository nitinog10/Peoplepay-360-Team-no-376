import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Dev-only chrome for the `/scratch` routes. Its own route group so these pages
 * sit outside the authenticated `(app)` shell — they exist to prove the
 * toolchain and the shared primitives, not to be part of the product.
 *
 * A group layout must not render <html>/<body>: this repo keeps a single root
 * layout (docs: 01-app/01-getting-started/02-project-structure.md).
 */
export default function DevLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 flex h-topbar items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
        <Link href="/scratch" className="font-heading text-sm font-semibold">
          PeoplePay360 <span className="text-muted-foreground">· scratch</span>
        </Link>
        <nav className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link href="/scratch" className="hover:text-foreground">
            Toolchain
          </Link>
          <Link href="/scratch/lists" className="hover:text-foreground">
            Lists &amp; forms
          </Link>
        </nav>
        <span className="ml-auto text-xs text-muted-foreground">dev only</span>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-content flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
