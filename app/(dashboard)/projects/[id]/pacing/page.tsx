"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type Beat = {
  label: string;
  tension: number;
  momentum: number;
  summary?: string;
};
type ChapterBeats = {
  chapter: number;
  title: string;
  wordCount: number;
  beats: Beat[];
  avgTension: number;
  avgMomentum: number;
};
type Analysis = {
  perChapter: ChapterBeats[];
  overall?: { shape?: string; warnings?: string[] };
  cached?: boolean;
};

export default function PacingPage() {
  const params = useParams<{ id: string }>();
  const bookId = params.id as Id<"books">;
  const latest = useQuery(api.pacing.latestForBook, { bookId });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(force: boolean) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze-beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, force }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  const display: Analysis | null = result ?? (latest?.result as Analysis) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => run(false)} disabled={running}>
          {running ? "Analyzing…" : display ? "Refresh" : "Analyze pacing"}
        </Button>
        {display && (
          <Button variant="outline" onClick={() => run(true)} disabled={running}>
            Force regenerate
          </Button>
        )}
        {result?.cached && (
          <span className="text-xs text-muted-foreground">
            From cache (content unchanged)
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {display && (
        <>
          {display.overall?.shape && (
            <div className="rounded-md border p-3 text-sm">
              <div>
                <span className="font-medium">Overall shape:</span>{" "}
                {display.overall.shape}
              </div>
              {display.overall.warnings && display.overall.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-yellow-900">
                  {display.overall.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-3">
            {display.perChapter?.map((c) => (
              <ChapterBlock key={c.chapter} chapter={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChapterBlock({ chapter }: { chapter: ChapterBeats }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {chapter.chapter}. {chapter.title}
        </span>
        <span className="text-muted-foreground">
          T {chapter.avgTension?.toFixed(1)} · M{" "}
          {chapter.avgMomentum?.toFixed(1)} · {chapter.wordCount?.toLocaleString()}w
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {chapter.beats?.map((b, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
            <span className="truncate">{b.label}</span>
            <Bar value={b.tension} colorClass="bg-red-300" />
            <Bar value={b.momentum} colorClass="bg-blue-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, colorClass }: { value: number; colorClass: string }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div className="h-2 w-24 rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
