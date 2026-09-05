import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Chrome for the unauthenticated screens: no sidebar, no session-dependent UI, so
 * it renders even while the bootstrap in `SessionProvider` is still in flight.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-topbar items-center px-4">
        <span className="font-heading text-sm font-semibold">PeoplePay360</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
