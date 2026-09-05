"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import type { ZodType } from "zod";

import { ApiError } from "@/lib/api";

/**
 * The bridge between a zod-validated RHF form and the API's error envelope.
 *
 * Client-side validation stops the obvious mistakes; the server still owns the
 * rules the browser cannot know (a duplicate department name, a leave request
 * over the remaining balance), and its refusals have to land somewhere useful:
 *
 * - **400 VALIDATION_ERROR** → one message per Zod issue, keyed by `path`, so it
 *   lands on the input that caused it.
 * - **409 UNIQUE_VIOLATION** → `details.target` is a MySQL index name, matched
 *   back against `fields` by `ApiError.fieldErrors()`; the message goes on that
 *   input *and* in the banner, since "already exists" reads oddly on its own.
 * - **422 BUSINESS_RULE_VIOLATION** → names no field, so it is banner-only.
 * - anything else (403, 500, a dead network) → banner.
 *
 * The first mapped field is focused, which is also what puts a long form back at
 * the input the server objected to.
 */

export interface ApiFormOptions<TValues extends FieldValues, TResult> {
  schema: ZodType<TValues>;
  defaultValues: DefaultValues<TValues>;
  submit: (values: TValues) => Promise<TResult>;
  onSuccess?: (result: TResult, values: TValues) => void;
  /**
   * The field names this form owns, for matching a 409's index name. Defaults to
   * the keys of `defaultValues`; pass a module's `*_FIELDS` when the form posts a
   * subset of them.
   */
  fields?: readonly string[];
}

export interface ApiForm<TValues extends FieldValues> {
  form: UseFormReturn<TValues>;
  /** Hand straight to `<Form api={…}>`, or to a `<form onSubmit>`. */
  onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  /** The error that belongs above the form rather than on one input. */
  formError: string | null;
  setFormError: (message: string | null) => void;
  isSubmitting: boolean;
}

export function useApiForm<TValues extends FieldValues, TResult>({
  schema,
  defaultValues,
  submit,
  onSuccess,
  fields,
}: ApiFormOptions<TValues, TResult>): ApiForm<TValues> {
  const form = useForm<TValues>({
    // A caller's `ZodType<TValues>` cannot be threaded through the resolver's own
    // generics — it pins the schema's *input* to `FieldValues`, which a generic
    // schema does not advertise. The casts are confined to this line, and
    // `TValues` still types every field name, default and error path in the form.
    resolver: zodResolver(schema as ZodType<TValues, TValues>) as unknown as Resolver<TValues>,
    defaultValues,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await submit(values);
      onSuccess?.(result, values);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(error instanceof Error ? error.message : "Something went wrong.");
        return;
      }
      const named = error.fieldErrors(fields ?? Object.keys(form.getValues()));
      let first = true;
      for (const [field, message] of Object.entries(named)) {
        form.setError(field as Path<TValues>, { type: "server", message }, { shouldFocus: first });
        first = false;
      }
      if (Object.keys(named).length === 0 || error.status === 409 || error.status === 422) {
        setFormError(error.message);
      }
    }
  });

  return { form, onSubmit, formError, setFormError, isSubmitting: form.formState.isSubmitting };
}
