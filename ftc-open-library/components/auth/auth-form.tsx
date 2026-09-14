"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { AuthActionState } from "@/lib/auth/actions";

export function AuthMessage({ error, notice }: { error?: string | null; notice?: string | null }) {
  if (!error && !notice) {
    return null;
  }
  return (
    <p
      role={error ? "alert" : "status"}
      className={error ? "text-sm text-danger" : "text-sm text-ink"}
    >
      {error ?? notice}
    </p>
  );
}

export function AuthForm({
  action,
  children,
  submitLabel,
}: {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, notice: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AuthMessage error={state.error} notice={state.notice} />
      <fieldset disabled={pending} className="flex flex-col gap-4 border-0 p-0">
        {children}
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Please wait…" : submitLabel}
      </Button>
    </form>
  );
}
