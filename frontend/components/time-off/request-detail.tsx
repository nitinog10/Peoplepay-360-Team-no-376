"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import Link from "next/link";

import { Forbidden, isForbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CancelRequestButton, DecisionRequestButton } from "@/components/time-off/request-actions";
import { RequestTimeOffDialog } from "@/components/time-off/request-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/use-can";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatDays } from "@/lib/format";

function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>; }

export function TimeOffRequestDetail({ requestId }: { requestId: number }) {
  const { can } = useCan(); const canDecide = can("time-off:decide"); const query = useQuery(api.timeOff.detail(requestId)); const approvalQuery = useQuery({ ...api.timeOff.approval(requestId), enabled: Boolean(query.data?.approval) });
  if (isForbidden(query.error)) return <Forbidden title="This request is not yours" description="You can only open time-off requests attached to your own employee profile." />;
  if (query.isPending) return <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-8"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  if (query.error || !query.data) return <div className="mx-auto w-full max-w-content px-4 py-8"><p role="alert" className="rounded-xl border p-6 text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : "Could not load the request."}</p></div>;
  const request = query.data; const approval = approvalQuery.data ?? request.approval;
  return <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-8"><Button asChild variant="ghost" className="w-fit"><Link href="/time-off/requests"><ArrowLeftIcon /> Back to requests</Link></Button><PageHeader title={request.leaveType.typeName} description={`${canDecide ? `${request.employee.firstName} ${request.employee.lastName} · ` : ""}Requested ${formatDateTime(request.requestedAt)}`}><StatusBadge status={request.status} />{canDecide && request.status === "PENDING" && <><DecisionRequestButton request={request} decision="APPROVED" /><DecisionRequestButton request={request} decision="REJECTED" /><CancelRequestButton request={request} /></>}{canDecide && request.status === "APPROVED" && <CancelRequestButton request={request} />}{!canDecide && request.status === "PENDING" && <><RequestTimeOffDialog request={request} trigger={<Button variant="outline"><PencilIcon /> Edit</Button>} /><CancelRequestButton request={request} /></>}</PageHeader><div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Card><CardHeader><CardTitle>Request details</CardTitle></CardHeader><CardContent><dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">{canDecide && <Detail label="Employee" value={`${request.employee.firstName} ${request.employee.lastName}`} />}<Detail label="Start date" value={formatDate(request.startDate)} /><Detail label="End date" value={formatDate(request.endDate)} /><Detail label="Computed duration" value={formatDays(request.totalDays)} /><Detail label="Status" value={<StatusBadge status={request.status} />} /><Detail label="Reason" value={request.reason ?? "—"} /><Detail label="Last updated" value={formatDateTime(request.updatedAt)} /></dl></CardContent></Card><Card><CardHeader><CardTitle>Decision</CardTitle></CardHeader><CardContent>{approvalQuery.isPending && query.data.approval ? <Skeleton className="h-28" /> : approvalQuery.error ? <div><p className="text-sm text-destructive">{approvalQuery.error instanceof ApiError ? approvalQuery.error.message : "Approval details could not be loaded."}</p><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void approvalQuery.refetch()}>Retry</Button></div> : approval ? <dl className="grid gap-4"><Detail label="Decision" value={<StatusBadge status={approval.decision} />} /><Detail label="Reviewed by" value={`${approval.reviewer.firstName} ${approval.reviewer.lastName}`} /><Detail label="Decided" value={formatDateTime(approval.decidedAt)} /><Detail label="Comments" value={approval.comments ?? "—"} /></dl> : <p className="text-sm text-muted-foreground">This request has not been reviewed yet.</p>}</CardContent></Card></div></div>;
}
