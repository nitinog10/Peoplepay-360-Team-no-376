"use client";

import { ChevronDownIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { isNavGroup, NAV, type NavEntry, type NavLink } from "./nav-config";

function isActive(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/** Permission-filtered navigation shared by desktop and the mobile drawer. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useCan();
  const pathname = usePathname();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const allowed = (link: NavLink) => !link.permission || can(link.permission);
  const entries = NAV.flatMap<NavEntry>((entry) => {
    if (!isNavGroup(entry)) return allowed(entry) ? [entry] : [];
    const children = entry.children.filter(allowed);
    return children.length > 0 ? [{ ...entry, children }] : [];
  });

  return (
    <div className="flex h-full w-sidebar flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-topbar shrink-0 items-center border-b border-sidebar-border px-4 pr-12 md:pr-4">
        <Brand onNavigate={onNavigate} />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {entries.map((entry) =>
            isNavGroup(entry) ? (
              <li key={entry.label}>
                <GroupButton
                  label={entry.label}
                  icon={<entry.icon className="size-4 shrink-0" />}
                  open={
                    toggled[entry.label] ??
                    entry.children.some((child) => isActive(pathname, child))
                  }
                  onToggle={(open) => setToggled((prev) => ({ ...prev, [entry.label]: open }))}
                >
                  {entry.children.map((child) => (
                    <li key={child.href}>
                      <NavItem
                        link={child}
                        active={isActive(pathname, child)}
                        onNavigate={onNavigate}
                        nested
                      />
                    </li>
                  ))}
                </GroupButton>
              </li>
            ) : (
              <li key={entry.href}>
                <NavItem link={entry} active={isActive(pathname, entry)} onNavigate={onNavigate} />
              </li>
            ),
          )}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-800 dark:bg-sidebar-accent dark:text-sidebar-accent-foreground">
          <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-[#F86126]" aria-hidden />
          <p className="leading-relaxed">People, time and payroll—connected in one place.</p>
        </div>
      </div>
    </div>
  );
}

function GroupButton({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <ChevronDownIcon
          className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")}
          aria-hidden
        />
      </button>
      {open && <ul className="mt-1 flex flex-col gap-1">{children}</ul>}
    </>
  );
}

function NavItem({
  link,
  active,
  nested,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
        nested && "ml-3 pl-4",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-full before:bg-sidebar-primary"
          : "text-sidebar-foreground/72 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
      )}
    >
      <link.icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{link.label}</span>
    </Link>
  );
}
