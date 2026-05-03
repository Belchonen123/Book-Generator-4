"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"request" | "sent">("request");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("flow", "reset");
    try {
      await signIn("password", fd);
      setStep("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 py-16">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          We'll email you a reset link.
        </p>
      </div>
      {step === "request" ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "..." : "Send reset link"}
          </Button>
        </form>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Check your email for a reset link.
        </p>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
