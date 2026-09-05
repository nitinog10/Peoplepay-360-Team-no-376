"use client";

import { useId } from "react";
import { useFormContext } from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label, control and message for one form field, wired for screen readers.
 *
 * The control is a render prop rather than a cloned child: spreading `control`
 * gives the input its `id`, its `aria-invalid` and the `aria-describedby` that
 * points at the hint and the error, and it stays plainly visible at the call site
 * which props came from where.
 *
 * Must sit inside `<Form>` — the message is read from RHF's context, so the same
 * `<Field>` renders a client-side zod message and a server-side 400 or 409
 * without knowing which it got.
 */

export interface FieldControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

/** RHF keys errors by path. These forms are flat, but `a.b` resolves too. */
function messageAt(errors: unknown, name: string): string | undefined {
  let node: unknown = errors;
  for (const part of name.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  const message = (node as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : undefined;
}

export function Field({
  name,
  label,
  description,
  required,
  className,
  children,
}: {
  /** The RHF field name — the same string passed to `register()`. */
  name: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}) {
  const id = useId();
  const { formState } = useFormContext();
  const message = messageAt(formState.errors, name);
  const hintId = description ? `${id}-hint` : undefined;
  const errorId = message ? `${id}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="text-destructive" title="Required">
              *
            </span>
          )}
        </Label>
      )}
      {children({
        id,
        "aria-invalid": Boolean(message),
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })}
      {description && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {message && (
        <p id={errorId} className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
