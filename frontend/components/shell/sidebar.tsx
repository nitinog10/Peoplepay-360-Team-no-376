"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { isNavGroup, NAV, type NavEntry, type NavLink } from "./nav-config";

function isActive(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/**
 * The whole menu is derived from `NAV` filtered through `can()` — there is no role
 * name anywhere in here. A group disappears once every child in it is filtered out,
 * which is how Payroll stays invisible until Phase 3 adds its permissions.
 *
 * `onNavigate` closes the mobile drawer; on desktop the sidebar is always open and
 * the prop is omitted.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useCan();
  const pathname = usePathname();
  // Groups open themselves when they contain the current route; this only records
  // the user's explicit clicks, so no effect has to sync it with the pathname.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const allowed = (link: NavLink) => !link.permission || can(link.permission);
  const entries = NAV.flatMap<NavEntry>((entry) => {
    if (!isNavGroup(entry)) return allowed(entry) ? [entry] : [];
    const children = entry.children.filter(allowed);
    return children.length > 0 ? [{ ...entry, children }] : [];
  });

  return (
    <div className="flex h-full w-sidebar flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-topbar shrink-0 items-center gap-2 px-4">
        <span className="grid size-6 place-items-center rounded-md bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
          PP
        </span>
        <span className="font-heading text-sm font-semibold">PeoplePay360</span>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-4">
        <ul className="flex flex-col gap-0.5">
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
                <NavItem
                  link={entry}
                  active={isActive(pathname, entry)}
                  onNavigate={onNavigate}
                />
              </li>
            ),
          )}
        </ul>
      </nav>
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
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <ChevronDownIcon
          className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open && <ul className="mt-0.5 flex flex-col gap-0.5">{children}</ul>}
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
        "flex items-center gap-2 rounded-md px-2 py-2 text-sm focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
        nested && "ml-3 pl-3",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <link.icon className="size-4 shrink-0" />
      {link.label}
    </Link>
  );
}
