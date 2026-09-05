"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ExternalLinkIcon, PencilIcon } from "lucide-react";
import Link from "next/link";

import { ContractFormDialog, TerminateContractDialog } from "@/components/contracts/contract-form-dialog";
import { Forbidden, isForbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>;
}

export function ContractDetail({ contractId }: { contractId: number }) {
  const { can } = useCan();
  const editable = can("contracts:write");
  const query = useQuery(api.contracts.detail(contractId));

  if (isForbidden(query.error)) return <Forbidden title="This contract is not yours" description="You can only open contracts attached to your own employee profile." />;
  if (query.isPending) return <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Could not load the contract."}</p></div>;

  const contract = query.data;
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8">
      <Button asChild variant="ghost" className="w-fit"><Link href="/contracts"><ArrowLeftIcon /> Back to contracts</Link></Button>
      <PageHeader
        title={`${contract.employee.firstName} ${contract.employee.lastName}`}
        description={`Contract #${contract.contractId}`}
      >
        {contract.isCurrent && <Badge className="bg-success/10 text-success">Current contract</Badge>}
        <StatusBadge status={contract.status} />
        {editable && (
          <ContractFormDialog contract={contract} trigger={<Button variant="outline"><PencilIcon /> Edit</Button>} />
        )}
        {editable && contract.status === "ACTIVE" && <TerminateContractDialog contract={contract} />}
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Contract information</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Contract type" value={<StatusBadge status={contract.contractType} />} />
            <Detail label="Status" value={<StatusBadge status={contract.status} />} />
            <Detail label="Base salary" value={formatCurrency(contract.baseSalary, contract.currency)} />
            <Detail label="Start date" value={formatDate(contract.startDate)} />
            <Detail label="End date" value={contract.endDate ? formatDate(contract.endDate) : "Open-ended"} />
            <Detail label="Currency" value={contract.currency ?? "—"} />
            <Detail label="Created" value={formatDateTime(contract.createdAt)} />
            <Detail label="Last updated" value={formatDateTime(contract.updatedAt)} />
            <Detail label="Created by" value={contract.creator ? `${contract.creator.firstName} ${contract.creator.lastName}` : "—"} />
          </dl>

          <div className="mt-6 border-t pt-4">
            {contract.documentUrl ? (
              <Button asChild variant="outline"><Link href={contract.documentUrl} target="_blank" rel="noreferrer"><ExternalLinkIcon /> Open contract document</Link></Button>
            ) : <p className="text-sm text-muted-foreground">No contract document is attached.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
