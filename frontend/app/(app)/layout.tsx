"use client";

import { useEffect, useState } from "react";

import { RequireSession } from "@/components/auth/require-session";
import { AttendanceWidget } from "@/components/attendance/widget";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

/**
 * The authenticated shell: permission-driven sidebar, topbar, scrolling content.
 *
 * The mobile drawer is a plain overlay rather than another UI primitive — it holds
 * no focus trap, so it stays a small amount of code, and Escape plus a click on the
 * scrim plus any nav click all close it. The topbar's `attendance` slot holds the punch
 * widget, which gates itself on `attendance:punch` and renders nothing without it.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const close = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <RequireSession>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden shrink-0 md:block">
          <Sidebar />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={close}
              className="absolute inset-0 bg-black/50"
            />
            <div className="absolute inset-y-0 left-0 shadow-xl">
              <Sidebar onNavigate={close} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenSidebar={() => setDrawerOpen(true)} attendance={<AttendanceWidget />} />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </RequireSession>
  );
}
