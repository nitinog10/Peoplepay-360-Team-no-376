"use client";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormBanner } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import {
  ApiError,
  api,
  employeeKeys,
  leaveBalanceKeys,
  timeOffKeys,
  type TimeOffRequest,
} from "@/lib/api";

function invalidateRequest(
  queryClient: ReturnType<typeof useQueryClient>,
  request: TimeOffRequest,
) {
  void queryClient.invalidateQueries({ queryKey: timeOffKeys.all });
  void queryClient.invalidateQueries({ queryKey: leaveBalanceKeys.all });
  void queryClient.invalidateQueries({ queryKey: employeeKeys.summary(request.employeeId) });
  void queryClient.invalidateQueries({ queryKey: employeeKeys.summary("me") });
}

/** All mutations for one request share a key so responsive remounts stay disabled. */
function requestMutationKey(requestId: number) {
  return ["time-off", "request-action", requestId] as const;
}

export function DecisionRequestButton({
  request,
  decision,
}: {
  request: TimeOffRequest;
  decision: "APPROVED" | "REJECTED";
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const approve = decision === "APPROVED";
  const mutationKey = requestMutationKey(request.timeOffRequestId);
  const requestBusy = useIsMutating({ mutationKey }) > 0;

  const decide = useMutation({
    mutationKey,
    mutationFn: () =>
      approve
        ? api.timeOff.approve(request.timeOffRequestId, { comments: comments.trim() || null })
        : api.timeOff.reject(request.timeOffRequestId, { comments: comments.trim() || null }),
    onSuccess: (saved) => {
      queryClient.setQueryData(timeOffKeys.detail(saved.timeOffRequestId), saved);
      invalidateRequest(queryClient, request);
      setOpen(false);
      toast.success(approve ? "Request approved" : "Request rejected");
    },
    onError: (caught) => {
      setError(
        caught instanceof ApiError ? caught.message : "The decision could not be saved.",
      );
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (requestBusy && next) return;
        setOpen(next);
        setError(null);
        if (next) setComments("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={approve ? "default" : "destructive"}
          size="sm"
          disabled={requestBusy}
        >
          {approve ? <CheckIcon /> : <XIcon />}
          {approve ? "Approve" : "Reject"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{approve ? "Approve" : "Reject"} this request?</DialogTitle>
          <DialogDescription>
            {request.employee.firstName} {request.employee.lastName} requested {request.totalDays}{" "}
            day(s) of {request.leaveType.typeName}.
          </DialogDescription>
        </DialogHeader>
        <FormBanner message={error} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`decision-comments-${request.timeOffRequestId}-${decision}`}>
            Comments
          </Label>
          <Textarea
            id={`decision-comments-${request.timeOffRequestId}-${decision}`}
            maxLength={5000}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            placeholder="Optional decision notes"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={requestBusy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={approve ? "default" : "destructive"}
            disabled={requestBusy}
            onClick={() => decide.mutate()}
          >
            {requestBusy && <LoaderCircleIcon className="animate-spin" />}
            {approve ? "Approve request" : "Reject request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelRequestButton({
  request,
  onCancelled,
}: {
  request: TimeOffRequest;
  onCancelled?: () => void;
}) {
  const { can } = useCan();
  const canDecide = can("time-off:decide");
  const queryClient = useQueryClient();
  const mutationKey = requestMutationKey(request.timeOffRequestId);
  const requestBusy = useIsMutating({ mutationKey }) > 0;
  const cancel = useMutation({
    mutationKey,
    mutationFn: () => api.timeOff.cancel(request.timeOffRequestId),
    onSuccess: (saved) => {
      queryClient.setQueryData(timeOffKeys.detail(saved.timeOffRequestId), saved);
      toast.success("Time-off request cancelled.");
      invalidateRequest(queryClient, request);
      onCancelled?.();
    },
    onError: (caught) =>
      toast.error(
        caught instanceof ApiError ? caught.message : "Could not cancel the request.",
      ),
  });

  if (request.status !== "PENDING" && !(canDecide && request.status === "APPROVED")) {
    return null;
  }

  const warning =
    request.status === "APPROVED"
      ? "Cancel this approved request and restore the employee's used leave balance?"
      : "Cancel this pending time-off request?";

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={requestBusy}
      onClick={() => {
        if (window.confirm(warning)) cancel.mutate();
      }}
    >
      {requestBusy ? <LoaderCircleIcon className="animate-spin" /> : <BanIcon />}
      Cancel
    </Button>
  );
}
