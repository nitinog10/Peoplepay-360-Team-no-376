"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckIcon, MinusIcon, RotateCwIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatRoleName } from "@/lib/format";

function title(value: string): string {
  return value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function RolesPermissionsMatrix() {
  const query = useQuery(api.users.rolePermissions());

  if (query.isPending) {
    return <div className="mx-auto w-full max-w-content px-4 py-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (query.isError) {
    return (
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8">
        <PageHeader title="Roles & Permissions" description="Read-only access catalogue for every system role." />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="font-medium">Could not load the permission matrix.</p>
          <p className="mt-1 text-sm text-muted-foreground">{query.error.message}</p>
          <Button className="mt-4" variant="outline" onClick={() => void query.refetch()}><RotateCwIcon /> Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <PageHeader title="Roles & Permissions" description="Review which code-defined capabilities each role receives." />
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="mb-4 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Permissions are code-defined in this build and cannot be edited here.
        </p>
        <Table>
          <TableCaption>Complete role × permission catalogue from the API.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Module</TableHead>
              <TableHead className="min-w-28">Action</TableHead>
              {query.data.roles.map((role) => (
                <TableHead key={role.roleName} className="min-w-32 text-center">{formatRoleName(role.roleName)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.permissions.map((permission) => {
              const [module, action] = permission.split(":");
              return (
                <TableRow key={permission}>
                  <TableCell className="font-medium">{title(module)}</TableCell>
                  <TableCell className="text-muted-foreground">{title(action)}</TableCell>
                  {query.data.roles.map((role) => {
                    const granted = role.permissions.includes(permission);
                    return (
                      <TableCell key={role.roleName} className="text-center">
                        <span className="inline-flex items-center justify-center" title={granted ? "Granted" : "Not granted"}>
                          {granted ? <CheckIcon className="size-4 text-success" aria-hidden="true" /> : <MinusIcon className="size-4 text-muted-foreground/50" aria-hidden="true" />}
                          <span className="sr-only">{granted ? "Granted" : "Not granted"}</span>
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
