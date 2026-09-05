"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { FormBanner } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";

type Props = {
  label: string;
  active: boolean;
  trigger?: React.ReactNode;
  onDelete: () => Promise<void>;
  onDeactivate: () => Promise<void>;
};

export function SalaryConfigDeleteDialog({ label, active, trigger, onDelete, onDeactivate }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canDeactivate, setCanDeactivate] = useState(false);

  async function run(action: "delete" | "deactivate") {
    setPending(true);
    setError(null);
    try {
      await (action === "delete" ? onDelete() : onDeactivate());
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `Could not ${action} ${label}.`);
      const details = caught instanceof ApiError && caught.details && typeof caught.details === "object" ? caught.details as { canDeactivate?: boolean } : undefined;
      setCanDeactivate(action === "delete" && details?.canDeactivate === true && active);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); setCanDeactivate(false); }}>
      <DialogTrigger asChild>{trigger ?? <Button type="button" variant="ghost" size="icon-sm" title={`Delete ${label}`}><Trash2Icon /><span className="sr-only">Delete</span></Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete {label}?</DialogTitle><DialogDescription>Unreferenced configuration is removed permanently. Payroll history prevents deletion and should be handled by deactivation.</DialogDescription></DialogHeader>
        <FormBanner message={error} />
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>{canDeactivate && <Button type="button" variant="secondary" disabled={pending} onClick={() => void run("deactivate")}>{pending && <LoaderCircleIcon className="animate-spin" />}Deactivate instead</Button>}<Button type="button" variant="destructive" disabled={pending} onClick={() => void run("delete")}>{pending && <LoaderCircleIcon className="animate-spin" />}Delete</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
