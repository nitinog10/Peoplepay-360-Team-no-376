"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BRAND_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

const BRAND_CLASS: Record<(typeof BRAND_STEPS)[number], string> = {
  50: "bg-brand-50",
  100: "bg-brand-100",
  200: "bg-brand-200",
  300: "bg-brand-300",
  400: "bg-brand-400",
  500: "bg-brand-500",
  600: "bg-brand-600",
  700: "bg-brand-700",
  800: "bg-brand-800",
  900: "bg-brand-900",
  950: "bg-brand-950",
};

/** Stand-in rows only — the real thing arrives with `DataTable` in FE-6. */
const ROWS = [
  { name: "Aarav Mehta", department: "Engineering", worked: "8.00", status: "Present" },
  { name: "Diya Sharma", department: "People Ops", worked: "7.25", status: "Late" },
  { name: "Kabir Rao", department: "Finance", worked: "0.00", status: "Absent" },
  { name: "Meera Iyer", department: "Engineering", worked: "9.50", status: "Overtime" },
];

const STATUS_CLASS: Record<string, string> = {
  Present: "bg-success/10 text-success",
  Late: "bg-warning/10 text-warning",
  Absent: "bg-destructive/10 text-destructive",
  Overtime: "bg-info/10 text-info",
};

export default function ScratchPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Toolchain scratch page
        </h1>
        <p className="text-sm text-muted-foreground">
          FE-2&apos;s gate: Button, Input, Dialog and Table rendering with our
          tokens in both light and dark. Flip the theme from the header.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
          <CardDescription>
            Brand ramp and semantic status colours from{" "}
            <code className="font-mono text-xs">app/globals.css</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1">
            {BRAND_STEPS.map((step) => (
              <div key={step} className="flex flex-col items-center gap-1">
                <div
                  className={`size-12 rounded-md border ${BRAND_CLASS[step]}`}
                />
                <span className="font-mono text-[0.625rem] text-muted-foreground">
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-success text-success-foreground">success</Badge>
            <Badge className="bg-warning text-warning-foreground">warning</Badge>
            <Badge className="bg-info text-info-foreground">info</Badge>
            <Badge variant="destructive">destructive</Badge>
            <Badge>primary</Badge>
            <Badge variant="secondary">secondary</Badge>
            <Badge variant="outline">outline</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Button</CardTitle>
          <CardDescription>Every variant, at three sizes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button
              variant="outline"
              onClick={() => toast.success("Toaster is wired up")}
            >
              Fire a toast
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Input</CardTitle>
          <CardDescription>
            Label, help text and the invalid state RHF will drive in FE-6.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="scratch-name">Full name</Label>
            <Input
              id="scratch-name"
              placeholder="Aarav Mehta"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {name ? `Hello, ${name}.` : "Type to prove state round-trips."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="scratch-email">Work email</Label>
            <Input
              id="scratch-email"
              type="email"
              defaultValue="not-an-email"
              aria-invalid
            />
            <p className="text-xs text-destructive">
              Enter a valid work email address.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dialog</CardTitle>
          <CardDescription>
            Portalled, focus-trapped, closes on Escape.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request time off</DialogTitle>
                <DialogDescription>
                  A stand-in for the real form, which lands in P1-4.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="scratch-reason">Reason</Label>
                <Input id="scratch-reason" placeholder="Family event" />
              </div>
              <DialogFooter showCloseButton>
                <Button
                  onClick={() => {
                    setOpen(false);
                    toast.success("Submitted (not really)");
                  }}
                >
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
          <CardDescription>
            Attendance-shaped rows, status colours from the semantic tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Worked</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.department}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.worked}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_CLASS[row.status]}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
