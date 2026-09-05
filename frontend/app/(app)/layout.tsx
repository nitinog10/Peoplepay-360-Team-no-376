"use client";

import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RequireSession } from "@/components/auth/require-session";
import { AttendanceWidget } from "@/components/attendance/widget";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Permission-driven application shell with an accessible mobile navigation drawer. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openDrawer = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;

    const drawer = drawerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    window.requestAnimationFrame(() => focusable()[0]?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };

    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  return (
    <RequireSession>
      <div className="flex min-h-0 flex-1 bg-secondary/55">
        <aside className="hidden shrink-0 md:block">
          <Sidebar />
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={closeDrawer}
              className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]"
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Main navigation"
              className="absolute inset-y-0 left-0 shadow-2xl"
            >
              <Sidebar onNavigate={closeDrawer} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation"
                onClick={closeDrawer}
                className="absolute top-4 right-3"
              >
                <XIcon />
              </Button>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenSidebar={openDrawer} attendance={<AttendanceWidget />} />
          <main className="min-h-0 flex-1 overflow-y-auto bg-secondary/55">{children}</main>
        </div>
      </div>
    </RequireSession>
  );
}
