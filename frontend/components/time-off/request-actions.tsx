"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormBanner } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import { ApiError, api, employeeKeys, leaveBalanceKeys, timeOffKeys, type TimeOffRequest } from "@/lib/api";

function invalidateRequest(queryClient: ReturnType<typeof useQueryClient>, request: TimeOffRequest) {
  void queryClient.invalidateQueries({ queryKey: timeOffKeys.all });
  void queryClient.invalidateQueries({ queryKey: leaveBalanceKeys.all });
  void queryClient.invalidateQueries({ queryKey: employeeKeys.summary(request.employeeId) });
  void queryClient.invalidateQueries({ queryKey: employeeKeys.summary("me") });
}

export function DecisionRequestButton({ request, decision }: { request: TimeOffRequest; decision: "APPROVED" | "REJECTED" }) {
  const queryClient = useQueryClient(); const [open, setOpen] = useState(false); const [comments, setComments] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null); const approve = decision === "APPROVED";
  async function decide() { setPending(true); setError(null); try { const saved = approve ? await api.timeOff.approve(request.timeOffRequestId, { comments: comments.trim() || null }) : await api.timeOff.reject(request.timeOffRequestId, { comments: comments.trim() || null }); queryClient.setQueryData(timeOffKeys.detail(saved.timeOffRequestId), saved); invalidateRequest(queryClient, request); setOpen(false); toast.success(approve ? "Request approved" : "Request rejected"); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The decision could not be saved."); } finally { setPending(false); } }
  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); if (next) setComments(""); }}><DialogTrigger asChild><Button type="button" variant={approve ? "default" : "destructive"} size="sm">{approve ? <CheckIcon /> : <XIcon />}{approve ? "Approve" : "Reject"}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{approve ? "Approve" : "Reject"} this request?</DialogTitle><DialogDescription>{request.employee.firstName} {request.employee.lastName} requested {request.totalDays} day(s) of {request.leaveType.typeName}.</DialogDescription></DialogHeader><FormBanner message={error} /><div className="flex flex-col gap-1.5"><Label htmlFor={`decision-comments-${request.timeOffRequestId}-${decision}`}>Comments</Label><Textarea id={`decision-comments-${request.timeOffRequestId}-${decision}`} maxLength={5000} value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Optional decision notes" /></div><DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant={approve ? "default" : "destructive"} disabled={pending} onClick={() => void decide()}>{pending && <LoaderCircleIcon className="animate-spin" />}{approve ? "Approve request" : "Reject request"}</Button></DialogFooter></DialogContent></Dialog>;
}

export function CancelRequestButton({ request, onCancelled }: { request: TimeOffRequest; onCancelled?: () => void }) {
  const { can } = useCan(); const canDecide = can("time-off:decide"); const queryClient = useQueryClient();
  const cancel = useMutation({ mutationFn: () => api.timeOff.cancel(request.timeOffRequestId), onSuccess: (saved) => { queryClient.setQueryData(timeOffKeys.detail(saved.timeOffRequestId), saved); toast.success("Time-off request cancelled."); invalidateRequest(queryClient, request); onCancelled?.(); }, onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not cancel the request.") });
  if (request.status !== "PENDING" && !(canDecide && request.status === "APPROVED")) return null;
  const warning = request.status === "APPROVED" ? "Cancel this approved request and restore the employee's used leave balance?" : "Cancel this pending time-off request?";
  return <Button variant="destructive" size="sm" disabled={cancel.isPending} onClick={() => { if (window.confirm(warning)) cancel.mutate(); }}>{cancel.isPending ? <LoaderCircleIcon className="animate-spin" /> : <BanIcon />}Cancel</Button>;
}
