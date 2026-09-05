"use client";

import { LogOutIcon, MenuIcon } from "lucide-react";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth/session";

function roleLabel(role: string): string {
  return role
    .split("_")
    .map((word) => (word === "HR" ? "HR" : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(" ");
}

/** Compact global actions: attendance, theme, account and the mobile menu. */
export function Topbar({
  onOpenSidebar,
  attendance,
}: {
  onOpenSidebar: () => void;
  attendance?: React.ReactNode;
}) {
  const { user, role, logout } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const employee = user?.employee;
  const name = employee ? `${employee.firstName} ${employee.lastName}` : "—";
  const initials = employee
    ? `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase()
    : "?";

  async function onLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="flex h-topbar shrink-0 items-center gap-2 border-b bg-background/92 px-3 backdrop-blur-md sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={onOpenSidebar}
      >
        <MenuIcon />
      </Button>
      <span className="font-display text-lg font-semibold md:hidden">PeoplePay</span>

      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
        {attendance}
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 min-w-0 gap-2 px-1.5 sm:px-2">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
              >
                {initials}
              </span>
              <span className="hidden max-w-40 truncate text-sm lg:inline">{name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="truncate">{name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {employee?.email}
              </span>
              <Badge variant="secondary" className="mt-1 w-fit">
                {role ? roleLabel(role) : "—"}
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signingOut} onSelect={() => void onLogout()}>
              <LogOutIcon /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
