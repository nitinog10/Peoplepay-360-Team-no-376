"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth/session";

/** Mirrors `loginSchema` in `src/modules/auth/schema.ts`. */
const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username or work email").max(150),
  password: z.string().min(1, "Enter your password").max(200),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * `?next=` is attacker-controlled, so only same-origin paths are honoured —
 * `//evil.example` is a valid URL to a browser and must not survive this.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggingIn, status } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  // Someone who still has a live session (or just signed in) has no business here.
  useEffect(() => {
    if (status !== "authenticated") return;
    router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, [status, router]);

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      await login(values);
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      // 400s land on a field; a 401 is deliberately vague ("Invalid credentials")
      // because the API will not say which half was wrong.
      for (const [field, message] of Object.entries(
        error.fieldErrors(["username", "password"]),
      )) {
        form.setError(field as keyof LoginValues, { message });
      }
      setFormError(error.message);
    }
  }

  const { errors } = form.formState;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-display text-xl">Sign in</CardTitle>
        <CardDescription>
          Use your username or your work email address.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {formError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username or email</Label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.username)}
              {...form.register("username")}
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isLoggingIn}>
            {isLoggingIn && <LoaderCircleIcon className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
