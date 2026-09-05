"use client";

import { LoaderCircleIcon } from "lucide-react";
import { FormProvider, type FieldValues } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ApiForm } from "./use-api-form";

/**
 * The `<form>` element, RHF's context and the form-level banner in one wrapper,
 * so every screen puts a server refusal in the same place.
 *
 * `noValidate` is deliberate: zod owns validation, and the browser's own bubbles
 * would pre-empt the messages `<Field>` renders.
 */
export function Form<TValues extends FieldValues>({
  api,
  banner = true,
  className,
  children,
  ...props
}: {
  api: ApiForm<TValues>;
  /** `false` when a screen places `<FormBanner>` itself. */
  banner?: boolean;
} & Omit<React.ComponentProps<"form">, "onSubmit">) {
  return (
    <FormProvider {...api.form}>
      <form
        noValidate
        onSubmit={api.onSubmit}
        className={cn("flex flex-col gap-4", className)}
        {...props}
      >
        {banner && <FormBanner message={api.formError} />}
        {children}
      </form>
    </FormProvider>
  );
}

/** The API's own wording for a refusal no single input owns. Renders nothing when null. */
export function FormBanner({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      {message}
    </p>
  );
}

/** Two-column field grid on anything wider than a phone. */
export function FormGrid({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)} {...props} />;
}

export function FormActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 pt-2", className)} {...props} />
  );
}

/** Submit with the pending spinner; disabled while in flight to stop double posts. */
export function SubmitButton({
  pending,
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button type="submit" disabled={disabled ?? pending} {...props}>
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {children}
    </Button>
  );
}
