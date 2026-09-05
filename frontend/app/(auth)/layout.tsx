import { ArrowUpRightIcon, CheckIcon } from "lucide-react";

import { Brand } from "@/components/shell/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/** Public chrome with the sign-in surface embedded in the product story panel. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const benefits = [
    "One employee record",
    "Clear approval flows",
    "Reliable payroll history",
    "Permission-aware access",
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-secondary/55">
      <header className="mx-auto flex h-topbar w-full max-w-3xl items-center px-4 sm:px-6">
        <Brand />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 pb-5 sm:px-6 sm:pb-8">
        <section className="relative flex w-full flex-col overflow-hidden rounded-3xl bg-[#714B67] px-5 py-6 text-white shadow-[0_24px_70px_rgba(67,42,59,0.16)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          <span
            aria-hidden
            className="absolute -top-16 -right-12 size-48 rounded-full border-[28px] border-[#14D3BB]/35"
          />
          <span
            aria-hidden
            className="absolute right-20 bottom-16 size-14 rotate-12 rounded-2xl bg-[#F86126]/90 sm:right-24"
          />
          <span
            aria-hidden
            className="absolute right-7 bottom-7 size-7 rounded-full bg-[#2EBCF4] sm:right-10"
          />

          <p className="relative flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase">
            One connected workplace <ArrowUpRightIcon className="size-3.5" />
          </p>

          <div className="relative mx-auto mt-7 flex w-full max-w-2xl justify-center px-0 py-3 sm:mt-9 sm:px-8 sm:py-6">
            {children}
          </div>

          <div className="relative mt-8 max-w-xl sm:mt-10">
            <h1 className="font-display text-5xl leading-[0.92] font-semibold sm:text-6xl">
              People at the heart of every payday.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/78 sm:mt-5">
              Employee records, attendance, leave and payroll stay connected—from the first
              check-in to the final payslip.
            </p>
            <ul className="mt-6 grid gap-3 pr-10 text-sm sm:grid-cols-2 sm:pr-0">
              {benefits.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/14">
                    <CheckIcon className="size-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
