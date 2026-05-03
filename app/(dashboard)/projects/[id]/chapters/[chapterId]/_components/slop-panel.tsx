"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type RegexHit = { phrase: string; count: number; excerpts: string[] };
type Deepdive = {
  flags?: { excerpt: string; issue: string; suggestion?: string }[];
} | null;

export function SlopPanel({ chapterId }: { chapterId: Id<"chapters"> }) {
  const cached = useQuery(api.slop.latestForChapter, { chapterId });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeep, setShowDeep] = useState(false);

  async function run(deepdive: boolean) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/slop-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId, deepdive }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  const regexHits = (cached?.regexHits ?? []) as RegexHit[];
  const deepdive = (cached?.deepdive ?? null) as Deepdive;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Slop scan
        </p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => run(false)} disabled={running}>
            {running ? "Scanning…" : "Quick scan"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => run(true)} disabled={running}>
            Deep scan
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!cached && (
        <p className="text-sm text-muted-foreground">
          No scan yet. Quick scan finds common LLM phrases instantly. Deep scan
          uses AI to flag generic passages.
        </p>
      )}

      {regexHits.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Phrase hits</p>
          <ul className="space-y-1 text-sm">
            {regexHits.map((hit) => (
              <li key={hit.phrase} className="rounded border p-2">
                <div className="flex justify-between">
                  <span className="font-mono text-xs">{hit.phrase}</span>
                  <span className="text-xs text-muted-foreground">
                    ×{hit.count}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {hit.excerpts.map((ex, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      {ex}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cached && regexHits.length === 0 && (
        <p className="text-sm text-green-700">No common LLM phrases detected.</p>
      )}

      {deepdive?.flags && deepdive.flags.length > 0 && (
        <div className="space-y-1">
          <button
            onClick={() => setShowDeep((v) => !v)}
            className="text-xs font-medium underline"
          >
            {showDeep ? "Hide" : "Show"} AI flags ({deepdive.flags.length})
          </button>
          {showDeep && (
            <ul className="space-y-2 text-sm">
              {deepdive.flags.map((f, i) => (
                <li key={i} className="rounded border bg-yellow-50 p-2 text-yellow-900">
                  <div className="italic">"{f.excerpt}"</div>
                  <div className="mt-1 text-xs">
                    <span className="font-medium">Issue:</span> {f.issue}
                  </div>
                  {f.suggestion && (
                    <div className="text-xs">
                      <span className="font-medium">Suggestion:</span> {f.suggestion}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
