"use client";

import {
  CalendarClockIcon,
  Clock3Icon,
  FileTextIcon,
  PlaneIcon,
  UserRoundIcon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Employee, EmployeeSummary } from "@/lib/api";
import { formatDate, toDateOnly } from "@/lib/format";

export type EmployeeEditableField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "dateOfBirth"
  | "address"
  | "hireDate"
  | "departmentId"
  | "jobTitle"
  | "managerId"
  | "status";

interface SelectOption {
  value: string;
  label: string;
}

export interface EmployeeDetailsProps {
  employee: Employee;
  summary?: EmployeeSummary;
  /** P1 uses true; P2 supplies controlled values through the same field layout. */
  readOnly: boolean;
  create?: boolean;
  onChange?: (field: EmployeeEditableField, value: string) => void;
  errors?: Partial<Record<EmployeeEditableField, string>>;
  departments?: readonly SelectOption[];
  managers?: readonly SelectOption[];
  disableStatus?: boolean;
  actions?: React.ReactNode;
}

function Detail({
  label,
  value,
  editValue,
  readOnly,
  field,
  inputType = "text",
  onChange,
  options,
  allowEmpty = false,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  editValue?: string;
  readOnly: boolean;
  field?: EmployeeEditableField;
  inputType?: React.HTMLInputTypeAttribute;
  onChange?: EmployeeDetailsProps["onChange"];
  options?: readonly SelectOption[];
  allowEmpty?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const editableValue = editValue ?? value;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>
        {readOnly || !field ? (
          <span className="text-sm font-medium">{value || "—"}</span>
        ) : options ? (
          <Select
            value={editableValue || (allowEmpty ? "__none__" : undefined)}
            disabled={disabled}
            onValueChange={(next) => onChange?.(field, next === "__none__" ? "" : next)}
          >
            <SelectTrigger className="w-full" aria-label={label} aria-invalid={Boolean(error)}>
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {allowEmpty && <SelectItem value="__none__">None</SelectItem>}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            type={inputType}
            value={editableValue}
            disabled={disabled}
            aria-label={label}
            aria-invalid={Boolean(error)}
            onChange={(event) => onChange?.(field, event.target.value)}
          />
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </dd>
    </div>
  );
}

function SmartButton({ href, icon, label, count }: { href: string; icon: React.ReactNode; label: string; count: number }) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start px-3 py-2.5">
      <Link href={href}>
        {icon}
        <span className="min-w-0 text-left">
          <span className="block font-medium">{label}</span>
          <span className="block text-xs font-normal text-muted-foreground">{count} records</span>
        </span>
      </Link>
    </Button>
  );
}

export function EmployeeDetails({
  employee,
  summary,
  readOnly,
  create = false,
  onChange,
  errors = {},
  departments = [],
  managers = [],
  disableStatus = false,
  actions,
}: EmployeeDetailsProps) {
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  const counts = summary?.counts;
  const employeeFilter = `employeeId=${employee.employeeId}`;
  const statusOptions = employee.status === "TERMINATED"
    ? [{ value: "TERMINATED", label: "Terminated" }]
    : [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 font-heading text-lg font-semibold text-primary">
          {initials || <UserRoundIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {create ? "New employee" : employee.fullName}
            </h1>
            {!create && <StatusBadge status={employee.status} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {create ? "Complete the work and private information below." : employee.jobTitle ?? "No job title"}
            {!create && employee.department ? ` · ${employee.department.departmentName}` : ""}
          </p>
          {!create && <p className="mt-1 text-sm text-muted-foreground">{employee.email}{employee.phone ? ` | ${employee.phone}` : ""}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {counts && !create && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Related employee records">
          <SmartButton href={`/contracts?${employeeFilter}`} icon={<FileTextIcon />} label="Contracts" count={counts.contracts} />
          <SmartButton href={`/attendance?${employeeFilter}`} icon={<Clock3Icon />} label="Attendance" count={counts.attendance} />
          <SmartButton href={`/time-off/requests?${employeeFilter}`} icon={<PlaneIcon />} label="Time off" count={counts.timeOffRequests} />
          <SmartButton href={`/time-off/balances?${employeeFilter}`} icon={<WalletCardsIcon />} label="Allocations" count={counts.leaveBalances} />
        </section>
      )}

      <Tabs defaultValue="work">
        <TabsList variant="line">
          <TabsTrigger value="work">Work Information</TabsTrigger>
          <TabsTrigger value="private">Private Information</TabsTrigger>
        </TabsList>

        <TabsContent value="work" className="pt-3">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader><CardTitle>Employment</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Detail label="First name" value={employee.firstName} field="firstName" readOnly={readOnly} onChange={onChange} error={errors.firstName} />
                  <Detail label="Last name" value={employee.lastName} field="lastName" readOnly={readOnly} onChange={onChange} error={errors.lastName} />
                  <Detail label="Department" value={employee.department?.departmentName ?? "—"} editValue={employee.departmentId ? String(employee.departmentId) : ""} field="departmentId" options={departments} allowEmpty readOnly={readOnly} onChange={onChange} error={errors.departmentId} />
                  <Detail label="Job title" value={employee.jobTitle ?? ""} field="jobTitle" readOnly={readOnly} onChange={onChange} error={errors.jobTitle} />
                  <Detail label="Manager" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "—"} editValue={employee.managerId ? String(employee.managerId) : ""} field="managerId" options={managers} allowEmpty readOnly={readOnly} onChange={onChange} error={errors.managerId} />
                  <Detail label="Hire date" value={readOnly ? formatDate(employee.hireDate) : toDateOnly(employee.hireDate)} inputType="date" field="hireDate" readOnly={readOnly} onChange={onChange} error={errors.hireDate} />
                  {!create && <Detail label="Employee ID" value={String(employee.employeeId)} readOnly />}
                  <Detail label="Status" value={employee.status} editValue={employee.status} field="status" options={statusOptions} disabled={disableStatus || employee.status === "TERMINATED"} readOnly={readOnly} onChange={onChange} error={errors.status} />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Current schedule</CardTitle></CardHeader>
              <CardContent>
                {summary?.currentSchedule ? (
                  <dl className="grid gap-4">
                    <Detail label="Schedule" value={summary.currentSchedule.scheduleName} readOnly />
                    <Detail label="Hours" value={`${summary.currentSchedule.startTime}–${summary.currentSchedule.endTime}`} readOnly />
                    <Detail label="Weekly hours" value={`${summary.currentSchedule.weeklyHours} hours`} readOnly />
                    <Detail label="Working days" value={`${summary.currentSchedule.daysPerWeek} days per week`} readOnly />
                  </dl>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClockIcon className="size-4" /> {create ? "Assign a schedule after creating the employee." : "No current schedule."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="private" className="pt-3">
          <Card>
            <CardHeader><CardTitle>Contact and personal details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Detail label="Work email" value={employee.email} inputType="email" field="email" readOnly={readOnly} onChange={onChange} error={errors.email} />
                <Detail label="Phone" value={employee.phone ?? ""} inputType="tel" field="phone" readOnly={readOnly} onChange={onChange} error={errors.phone} />
                <Detail label="Date of birth" value={employee.dateOfBirth ? (readOnly ? formatDate(employee.dateOfBirth) : toDateOnly(employee.dateOfBirth)) : ""} inputType="date" field="dateOfBirth" readOnly={readOnly} onChange={onChange} error={errors.dateOfBirth} />
                <Detail label="Address" value={employee.address ?? ""} field="address" readOnly={readOnly} onChange={onChange} error={errors.address} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
