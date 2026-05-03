"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

export function OnboardingPrompt() {
  const me = useQuery(api.profiles.me);
  const complete = useMutation(api.profiles.completeOnboarding);
  if (!me?.profile || me.profile.hasSeenOnboarding) return null;
  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <h2 className="font-medium">Welcome to Book Generator</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Set your pen name and bio so they show up on covers and exports.
      </p>
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm">
          <Link href="/profile">Set up profile</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => complete({})}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
