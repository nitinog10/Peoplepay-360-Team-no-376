import { ArrowUpRightIcon, CheckIcon } from "lucide-react";

import { Brand } from "@/components/shell/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/** Public chrome with a restrained product story on wide screens. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-secondary/55">
      <header className="mx-auto flex h-topbar w-full max-w-content items-center px-4 sm:px-6">
        <Brand />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-content flex-1 items-stretch gap-8 px-4 pb-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-8">
        <section className="relative hidden min-h-[35rem] overflow-hidden rounded-3xl bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <span aria-hidden className="absolute -top-16 -right-12 size-48 rounded-full border-[28px] border-[#14D3BB]/35" />
          <span aria-hidden className="absolute right-24 bottom-20 size-16 rotate-12 rounded-2xl bg-[#F86126]/80" />
          <span aria-hidden className="absolute right-10 bottom-8 size-8 rounded-full bg-[#2EBCF4]" />

          <p className="relative flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold tracking-wide uppercase">
            One connected workplace <ArrowUpRightIcon className="size-3.5" />
          </p>

          <div className="relative max-w-xl">
            <h1 className="font-display text-6xl leading-[0.92] font-semibold">
              People at the heart of every payday.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-primary-foreground/78">
              Employee records, attendance, leave and payroll stay connected—from the first
              check-in to the final payslip.
            </p>
            <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
              {[
                "One employee record",
                "Clear approval flows",
                "Reliable payroll history",
                "Permission-aware access",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-white/14">
                    <CheckIcon className="size-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="flex items-center justify-center py-8 lg:py-12">{children}</div>
      </main>
    </div>
  );
}
