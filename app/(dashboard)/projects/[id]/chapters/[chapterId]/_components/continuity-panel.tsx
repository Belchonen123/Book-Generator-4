"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

const SEVERITY_CLASS = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warn: "border-yellow-200 bg-yellow-50 text-yellow-900",
  error: "border-red-200 bg-red-50 text-red-900",
} as const;

export function ContinuityPanel({ chapterId }: { chapterId: Id<"chapters"> }) {
  const warnings = useQuery(api.continuity.listForChapter, { chapterId });
  const dismiss = useMutation(api.continuity.dismiss);
  const resolve = useMutation(api.continuity.resolve);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/check-consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Continuity
        </p>
        <Button size="sm" variant="outline" onClick={run} disabled={running}>
          {running ? "Checking…" : "Check now"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {warnings === undefined ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : warnings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active warnings.</p>
      ) : (
        <ul className="space-y-2">
          {warnings.map((w) => (
            <li
              key={w._id}
              className={`rounded-md border p-2 text-sm ${SEVERITY_CLASS[w.severity]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{w.title}</div>
                  <div className="mt-0.5 text-sm">{w.detail}</div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolve({ id: w._id })}
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismiss({ id: w._id })}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
